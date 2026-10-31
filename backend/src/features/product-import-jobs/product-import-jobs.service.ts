import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  ProductImportItemStatus,
  ProductImportJobStatus,
  ProductType,
  ProductCurrency,
  Prisma,
  UserRole,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserEntity } from 'src/auth/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ImportErrorRow,
  ImportResponseDto,
  ImportParsedRow,
} from 'src/shared/dto/import-response.dto';
import {
  XlsxColumnDefinition,
  XlsxImportService,
} from 'src/shared/services/xlsx-import.service';
import {
  AIRCRAFT_COLUMNS,
  BOAT_COLUMNS,
  CAR_COLUMNS,
} from 'src/shared/constants/product-columns';
import { CreateCarDto } from '../cars/dto/create-car.dto';
import { CreateBoatDto } from '../boats/dto/create-boat.dto';
import { CreateAircraftDto } from '../aircrafts/dto/create-aircraft.dto';
import { DriveImportService } from '../drive-import/drive-import.service';
import {
  updateProductWithMonetaryLock,
} from '../products/product-monetary-lock';
import { ActorContext } from 'src/shared/actor-context/actor-context.service';
import { DelegatedActionAuditService } from 'src/shared/actor-context/delegated-action-audit.service';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export type ProductImportMode = 'ADDITIVE' | 'SYNCHRONIZE';

export type ProductImportOptions = {
  context?: ActorContext;
  mode?: ProductImportMode | string;
  confirmSynchronize?: boolean | string;
  synchronizePreviewToken?: string;
};

type SynchronizePreviewClaims = {
  version: 2;
  csvDigest: string;
  specialistId: string;
  productType: ProductType;
  mode: 'SYNCHRONIZE';
  candidateDigest: string;
  catalogDigest: string;
  expiresAt: number;
};

type CatalogProductSnapshot = {
  id: string;
  identificador: string;
  isActive: boolean;
  updatedAt: string;
  rowVersion: string;
};

type SynchronizePreviewSnapshot = {
  candidateIds: string[];
  csvDigest: string;
  catalogDigest: string;
  catalogProducts: CatalogProductSnapshot[];
};

type ImportImpact = {
  incomingItems: number;
  activeItemsBefore: number;
  matchingItems: number;
  newOrReactivatedItems: number;
  deactivationCandidates: number;
};

type SynchronizationCatalogSnapshot = {
  candidateIds: string[];
  catalogDigest: string;
  catalogProducts: CatalogProductSnapshot[];
  impact: ImportImpact;
};

type UpsertResult = {
  productId: string;
  action: 'CREATED' | 'UPDATED';
  reactivated?: boolean;
  updatedAt?: string;
};

type ProductImportEffect = {
  productId: string;
  action: 'CREATED' | 'UPDATED';
  rowVersion: string;
  updatedAt?: string;
  reactivated?: boolean;
};

type ImportItemPayload = ImportParsedRow & {
  __productImportEffect?: ProductImportEffect;
};

class ProductImportJobLeaseLostError extends Error {
  constructor() {
    super('Lease do job de importação perdido para outro worker.');
    this.name = 'ProductImportJobLeaseLostError';
  }
}

// identificador nunca chega vazio de parseImportRows (é gerado quando falta);
// a checagem protege payloads montados por outro caminho.
const REQUIRED_PRODUCT_FIELDS = [
  { key: 'identificador', label: 'Identificador' },
  { key: 'valor', label: 'Valor do produto' },
  { key: 'currency', label: 'Moeda (use BRL ou USD)' },
] as const;

// Produto importado só com valor e moeda: o que aparece no catálogo até alguém
// completar o cadastro. Aplicado só na criação, para um reimport não apagar o
// que foi editado à mão.
const DEFAULT_MARCA: Record<ProductType, string> = {
  [ProductType.CAR]: 'Carro',
  [ProductType.BOAT]: 'Lancha',
  [ProductType.AIRCRAFT]: 'Aeronave',
};
const DEFAULT_ESTADO = 'não informado';

// Colunas que não descrevem o produto: ficam fora do identificador automático
// para que reimportar com outro preço ou outras fotos atualize o mesmo produto.
const NON_DESCRIPTIVE_COLUMNS = new Set([
  'identificador',
  'valor',
  'currency',
  'folder_url',
]);
export const AUTO_IDENTIFIER_PREFIX = 'auto-';

export function isImportSpreadsheet(fileName?: string): boolean {
  return /\.(xlsx|csv)$/i.test(fileName ?? '');
}

@Injectable()
export class ProductImportJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductImportJobsService.name);
  private readonly runningJobs = new Set<string>();
  private readonly lostJobLeases = new Set<string>();
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly xlsxImportService: XlsxImportService,
    private readonly driveImportService: DriveImportService,
    @Optional()
    private readonly delegatedAudit?: DelegatedActionAuditService,
  ) {}

  private isMissingImportJobsTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021' &&
      `${error.meta?.table ?? ''}`.includes('ProductImportJob')
    );
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }

  private async runSerializableWithRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isSerializationFailure(error) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new Error('Unreachable serializable transaction retry state');
  }

  onModuleInit() {
    this.recoverPendingJobs().catch((error) => {
      this.logger.error('Falha ao recuperar jobs pendentes', error);
    });

    this.recoveryTimer = setInterval(() => {
      this.recoverPendingJobs().catch((error) => {
        this.logger.error('Falha ao recuperar jobs pendentes', error);
      });
    }, 30000);
  }

  onModuleDestroy() {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }
  }

  async createJobFromCsv(
    fileBuffer: Buffer,
    user: UserEntity,
    productType: ProductType,
    options: ProductImportOptions = {},
  ) {
    const mode = `${options.mode ?? 'ADDITIVE'}`.toUpperCase();
    if (mode !== 'ADDITIVE' && mode !== 'SYNCHRONIZE') {
      throw new BadRequestException(
        'Modo de importação inválido. Use ADDITIVE ou SYNCHRONIZE.',
      );
    }
    const syncConfirmed =
      options.confirmSynchronize === true ||
      `${options.confirmSynchronize}`.toLowerCase() === 'true';
    if (mode === 'SYNCHRONIZE' && !syncConfirmed) {
      throw new BadRequestException(
        'A sincronização exige confirmação explícita do alvo, tipo e impacto.',
      );
    }
    if (mode === 'SYNCHRONIZE' && !options.synchronizePreviewToken) {
      throw new BadRequestException({
        code: 'SYNCHRONIZE_PREVIEW_REQUIRED',
        message:
          'A sincronização exige uma prévia válida. Gere uma nova prévia e confirme novamente.',
      });
    }

    const normalizedRows = await this.parseImportRows(fileBuffer, productType);
    const specialistId = options.context?.specialistId ?? user.id;
    let creationResult;
    try {
      creationResult = await this.runSerializableWithRetry(async (tx) => {
        if (mode === 'SYNCHRONIZE') {
          await this.lockProductCatalogForSnapshot(tx, productType);
        }
        const validatedSynchronization =
          mode === 'SYNCHRONIZE'
            ? await this.validateSynchronizePreviewToken(
                options.synchronizePreviewToken!,
                fileBuffer,
                productType,
                specialistId,
                normalizedRows,
                tx,
              )
            : null;
        const synchronizeSnapshot: SynchronizePreviewSnapshot | null =
          validatedSynchronization
            ? {
                candidateIds: validatedSynchronization.candidateIds,
                csvDigest: validatedSynchronization.csvDigest,
                catalogDigest: validatedSynchronization.catalogDigest,
                catalogProducts: validatedSynchronization.catalogProducts,
              }
            : null;
        const impact =
          validatedSynchronization?.impact ??
          (await this.estimateImportImpact(
            productType,
            specialistId,
            normalizedRows,
            mode,
            tx,
          ));
        const job = await tx.productImportJob.create({
          data: {
            product_type: productType,
            specialist_id: specialistId,
            status: ProductImportJobStatus.PENDING,
            total_items: normalizedRows.length,
            items: {
              createMany: {
                data: normalizedRows.map((row, index) => ({
                  row_number: index + 2,
                  payload: row,
                  folder_url: row.folder_url?.trim() || null,
                })),
              },
            },
          },
          select: {
            id: true,
            status: true,
            total_items: true,
            product_type: true,
          },
        });
        await tx.$executeRaw`
          UPDATE "ProductImportJob"
          SET "mode" = ${mode},
              "sync_confirmed" = ${syncConfirmed},
              "created_by_id" = ${user.id}::uuid,
              "sync_preview_snapshot" = ${synchronizeSnapshot ? JSON.stringify(synchronizeSnapshot) : null}::jsonb
          WHERE "id" = ${job.id}::uuid
        `;
        if (options.context && this.delegatedAudit) {
          await this.delegatedAudit.record(
            {
              context: options.context,
              action: 'PRODUCT_IMPORT_CREATE',
              resourceType: productType,
              resourceId: job.id,
              metadata: { mode, impact },
            },
            tx,
          );
        }
        return { job, impact };
      });
    } catch (error) {
      if (this.isMissingImportJobsTableError(error)) {
        throw new BadRequestException(
          'A importação assíncrona ainda não está disponível neste ambiente. Aplique as migrations pendentes e tente novamente.',
        );
      }
      throw error;
    }

    const { job: createdJob, impact } = creationResult;

    this.scheduleJob(createdJob.id);

    return {
      jobId: createdJob.id,
      status: createdJob.status,
      productType: createdJob.product_type,
      totalItems: createdJob.total_items,
      targetSpecialistId: specialistId,
      mode,
      synchronizeConfirmed: syncConfirmed,
      impact,
      pollIntervalMs: 2000,
      message: 'Importação recebida e iniciada em segundo plano.',
    };
  }

  async previewCsvImport(
    fileBuffer: Buffer,
    productType: ProductType,
    specialistId: string,
    requestedMode: ProductImportMode | string = 'ADDITIVE',
  ) {
    const mode = `${requestedMode}`.toUpperCase();
    if (mode !== 'ADDITIVE' && mode !== 'SYNCHRONIZE') {
      throw new BadRequestException(
        'Modo de importação inválido. Use ADDITIVE ou SYNCHRONIZE.',
      );
    }
    const normalizedRows = await this.parseImportRows(fileBuffer, productType);
    const catalogSnapshot = await this.getSynchronizationCatalogSnapshot(
      productType,
      specialistId,
      normalizedRows,
    );
    const impact =
      mode === 'SYNCHRONIZE'
        ? catalogSnapshot.impact
        : this.deriveImportImpact(
            catalogSnapshot.impact.activeItemsBefore,
            catalogSnapshot.impact.matchingItems,
            normalizedRows,
            0,
          );
    const synchronizePreviewToken =
      mode === 'SYNCHRONIZE'
        ? this.createSynchronizePreviewToken(
            fileBuffer,
            productType,
            specialistId,
            catalogSnapshot,
          )
        : undefined;
    return {
      productType,
      targetSpecialistId: specialistId,
      mode,
      requiresExplicitConfirmation: mode === 'SYNCHRONIZE',
      impact,
      synchronizePreviewToken,
    };
  }

  private createSynchronizePreviewToken(
    fileBuffer: Buffer,
    productType: ProductType,
    specialistId: string,
    snapshot: SynchronizationCatalogSnapshot,
  ): string {
    const claims: SynchronizePreviewClaims = {
      version: 2,
      csvDigest: this.sha256(fileBuffer),
      specialistId,
      productType,
      mode: 'SYNCHRONIZE',
      candidateDigest: this.sha256(snapshot.candidateIds.join(',')),
      catalogDigest: snapshot.catalogDigest,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', this.getPreviewSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private async validateSynchronizePreviewToken(
    token: string,
    fileBuffer: Buffer,
    productType: ProductType,
    specialistId: string,
    rows: ImportParsedRow[],
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<{
    candidateIds: string[];
    csvDigest: string;
    catalogDigest: string;
    catalogProducts: CatalogProductSnapshot[];
    impact: ImportImpact;
  }> {
    try {
      const [payload, providedSignature, extra] = token.split('.');
      if (!payload || !providedSignature || extra) {
        throw new Error('token malformado');
      }
      const expectedSignature = createHmac('sha256', this.getPreviewSecret())
        .update(payload)
        .digest();
      const providedSignatureBuffer = Buffer.from(
        providedSignature,
        'base64url',
      );
      if (
        providedSignatureBuffer.length !== expectedSignature.length ||
        !timingSafeEqual(providedSignatureBuffer, expectedSignature)
      ) {
        throw new Error('assinatura inválida');
      }

      const claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as SynchronizePreviewClaims;
      const catalogSnapshot = await this.getSynchronizationCatalogSnapshot(
        productType,
        specialistId,
        rows,
        client,
      );
      const { candidateIds, catalogDigest, catalogProducts, impact } =
        catalogSnapshot;
      const csvDigest = this.sha256(fileBuffer);
      const scopeMatches =
        claims.version === 2 &&
        claims.mode === 'SYNCHRONIZE' &&
        claims.productType === productType &&
        claims.specialistId === specialistId &&
        claims.csvDigest === csvDigest &&
        claims.candidateDigest === this.sha256(candidateIds.join(',')) &&
        claims.catalogDigest === catalogDigest &&
        claims.expiresAt >= Date.now();
      if (!scopeMatches) {
        throw new Error('escopo ou snapshot divergente');
      }
      return {
        candidateIds,
        csvDigest,
        catalogDigest,
        catalogProducts,
        impact,
      };
    } catch {
      throw new ConflictException({
        code: 'SYNCHRONIZE_PREVIEW_STALE',
        message:
          'A prévia de sincronização expirou ou o catálogo/CSV mudou. Gere uma nova prévia antes de confirmar.',
      });
    }
  }

  private async getSynchronizationCatalogSnapshot(
    productType: ProductType,
    specialistId: string,
    rows: ImportParsedRow[],
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<SynchronizationCatalogSnapshot> {
    const incomingIdentifiers = new Set(
      rows.map((row) => row.identificador?.trim()).filter(Boolean),
    );
    const catalogProducts = await this.getCatalogProductsByType(
      productType,
      specialistId,
      client,
    );
    const activeProducts = catalogProducts.filter((product) => product.isActive);
    const matchingItems = activeProducts.filter((product) =>
      incomingIdentifiers.has(product.identificador),
    ).length;
    const candidateIds = activeProducts
      .filter((product) => !incomingIdentifiers.has(product.identificador))
      .map((product) => product.id)
      .sort();
    return {
      candidateIds,
      catalogDigest: this.catalogDigest(catalogProducts),
      catalogProducts,
      impact: this.deriveImportImpact(
        activeProducts.length,
        matchingItems,
        rows,
        candidateIds.length,
      ),
    };
  }

  private sha256(value: Buffer | string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private catalogDigest(products: CatalogProductSnapshot[]): string {
    const canonical = [...products].sort((left, right) =>
      left.id.localeCompare(right.id),
    ).map((product) => [
      product.id,
      product.identificador,
      product.isActive,
      product.updatedAt,
      product.rowVersion,
    ]);
    return this.sha256(JSON.stringify(canonical));
  }

  private getPreviewSecret(): string {
    const secret =
      process.env.PRODUCT_IMPORT_PREVIEW_SECRET ??
      process.env.JWT_SECRET_ACCESS;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'test') {
      return 'product-import-preview-test-secret';
    }
    throw new Error(
      'PRODUCT_IMPORT_PREVIEW_SECRET ou JWT_SECRET_ACCESS deve estar configurado.',
    );
  }

  async getJobStatus(
    jobId: string,
    user: UserEntity,
    representedSpecialistId?: string,
  ) {
    let job;
    try {
      job = await this.prisma.productImportJob.findUnique({
        where: { id: jobId },
        include: {
          items: {
            orderBy: { row_number: 'asc' },
            select: {
              row_number: true,
              status: true,
              payload: true,
              action: true,
              product_id: true,
              error_message: true,
              warnings: true,
            },
          },
        },
      });
    } catch (error) {
      if (this.isMissingImportJobsTableError(error)) {
        throw new BadRequestException(
          'A importação assíncrona ainda não está disponível neste ambiente. Aplique as migrations pendentes e tente novamente.',
        );
      }
      throw error;
    }

    if (!job) {
      throw new NotFoundException('Job de importação não encontrado');
    }

    if (user.role !== UserRole.ADMIN && job.specialist_id !== user.id) {
      throw new ForbiddenException(
        'Sem permissão para visualizar este job de importação',
      );
    }
    if (
      user.role === UserRole.ADMIN &&
      representedSpecialistId &&
      job.specialist_id !== representedSpecialistId
    ) {
      throw new ForbiddenException(
        'O job não pertence ao especialista representado.',
      );
    }

    const response = this.buildImportResponse(job.items, {
      deactivatedIds: Array.isArray(job.deactivated_product_ids)
        ? (job.deactivated_product_ids as string[])
        : [],
      reactivatedCount: job.reactivated_items,
    });
    if (
      job.status === ProductImportJobStatus.COMPLETED_WITH_ERRORS &&
      job.error_message
    ) {
      response.message = job.error_message;
    }

    return {
      jobId: job.id,
      status: job.status,
      productType: job.product_type,
      totalItems: job.total_items,
      processedItems: job.processed_items,
      successItems: job.success_items,
      warningItems: job.warning_items,
      failedItems: job.failed_items,
      deactivatedItems: job.deactivated_items,
      reactivatedItems: job.reactivated_items,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      errorMessage: job.error_message,
      done:
        job.status === ProductImportJobStatus.COMPLETED ||
        job.status === ProductImportJobStatus.COMPLETED_WITH_ERRORS ||
        job.status === ProductImportJobStatus.FAILED,
      result: response,
    };
  }

  private async recoverPendingJobs() {
    let jobs: Array<{ id: string }> = [];
    try {
      jobs = await this.prisma.productImportJob.findMany({
        where: {
          status: {
            in: [
              ProductImportJobStatus.PENDING,
              ProductImportJobStatus.PROCESSING,
            ],
          },
        },
        select: { id: true },
        orderBy: { created_at: 'asc' },
        take: 20,
      });
    } catch (error) {
      if (this.isMissingImportJobsTableError(error)) {
        this.logger.warn(
          'Tabela ProductImportJob não encontrada. Recuperação de jobs pendentes ficará desativada até aplicar as migrations.',
        );
        return;
      }
      throw error;
    }

    for (const job of jobs) {
      this.scheduleJob(job.id);
    }
  }

  private scheduleJob(jobId: string) {
    if (this.runningJobs.has(jobId)) {
      return;
    }

    this.runningJobs.add(jobId);

    setImmediate(() => {
      this.processJob(jobId)
        .catch((error) => {
          this.logger.error(`Falha ao processar job ${jobId}`, error);
        })
        .finally(() => {
          this.runningJobs.delete(jobId);
        });
    });
  }

  private async processJob(jobId: string) {
    const leaseToken = await this.claimJob(jobId);
    if (!leaseToken) return;
    const leaseKey = this.jobLeaseKey(jobId, leaseToken);
    const heartbeat = setInterval(() => {
      this.renewJobLease(jobId, leaseToken)
        .then((renewed) => {
          if (!renewed) this.lostJobLeases.add(leaseKey);
        })
        .catch((error) => {
          // Falha de transporte deixa a posse desconhecida; o próximo fence
          // consulta o PostgreSQL. Somente UPDATE 0 prova perda definitiva.
          this.logger.error(`Falha ao renovar lease do job ${jobId}`, error);
        });
    }, 15000);
    heartbeat.unref?.();
    try {
      await this.processClaimedJob(jobId, leaseToken);
    } finally {
      clearInterval(heartbeat);
      await this.releaseJobLease(jobId, leaseToken);
      this.lostJobLeases.delete(leaseKey);
    }
  }

  private jobLeaseKey(jobId: string, leaseToken: string): string {
    return `${jobId}:${leaseToken}`;
  }

  private throwIfJobLeaseLost(jobId: string, leaseToken: string): void {
    if (this.lostJobLeases.has(this.jobLeaseKey(jobId, leaseToken))) {
      throw new ProductImportJobLeaseLostError();
    }
  }

  private async claimJob(jobId: string): Promise<string | null> {
    const leaseToken = randomUUID();
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ProductImportJob"
      SET "status" = ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus",
          "started_at" = COALESCE("started_at", NOW()),
          "error_message" = NULL,
          "processing_lease_token" = ${leaseToken}::uuid,
          "processing_lease_expires_at" = NOW() + INTERVAL '5 minutes',
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "status" IN (
          ${ProductImportJobStatus.PENDING}::"ProductImportJobStatus",
          ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus"
        )
        AND (
          "status" = ${ProductImportJobStatus.PENDING}::"ProductImportJobStatus"
          OR "processing_lease_token" IS NULL
          OR "processing_lease_expires_at" <= NOW()
        )
      RETURNING "id"
    `;
    return claimed.length === 1 ? leaseToken : null;
  }

  private async renewJobLease(
    jobId: string,
    leaseToken: string,
  ): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "processing_lease_expires_at" = GREATEST(
            "processing_lease_expires_at",
            NOW() + INTERVAL '5 minutes'
          ),
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "status" = ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus"
        AND "processing_lease_expires_at" > NOW()
    `;
    return updated === 1;
  }

  private async extendJobLeaseForExternalEffect(
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    this.throwIfJobLeaseLost(jobId, leaseToken);
    const updated = await this.prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "processing_lease_expires_at" = GREATEST(
            "processing_lease_expires_at",
            NOW() + INTERVAL '30 minutes'
          ),
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "status" = ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus"
        AND "processing_lease_expires_at" > NOW()
    `;
    if (updated !== 1) {
      this.lostJobLeases.add(this.jobLeaseKey(jobId, leaseToken));
      throw new ProductImportJobLeaseLostError();
    }
  }

  private async assertJobLeaseOwned(
    tx: Prisma.TransactionClient,
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    this.throwIfJobLeaseLost(jobId, leaseToken);
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ProductImportJob"
      WHERE "id" = ${jobId}::uuid
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "status" = ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus"
        AND "processing_lease_expires_at" > NOW()
      FOR UPDATE
    `;
    if (owned.length !== 1) {
      this.lostJobLeases.add(this.jobLeaseKey(jobId, leaseToken));
      throw new ProductImportJobLeaseLostError();
    }
  }

  private isJobLeaseLost(error: unknown): boolean {
    return error instanceof ProductImportJobLeaseLostError;
  }

  private async releaseJobLease(
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "processing_lease_token" = NULL,
          "processing_lease_expires_at" = NULL,
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "processing_lease_expires_at" > NOW()
    `;
  }

  private async pauseIneligibleJob(
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "status" = ${ProductImportJobStatus.PENDING}::"ProductImportJobStatus",
          "error_message" = 'Job pausado: especialista-alvo inativo ou incompatível com o tipo do produto.',
          "processing_lease_token" = NULL,
          "processing_lease_expires_at" = NULL,
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "processing_lease_expires_at" > NOW()
    `;
  }

  private async processClaimedJob(jobId: string, leaseToken: string) {
    const job = await this.prisma.productImportJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: { row_number: 'asc' },
        },
      },
    });

    if (!job) {
      return;
    }

    if (
      job.status === ProductImportJobStatus.COMPLETED ||
      job.status === ProductImportJobStatus.COMPLETED_WITH_ERRORS ||
      job.status === ProductImportJobStatus.FAILED
    ) {
      return;
    }

    const executionContext = await this.getJobExecutionContext(job);
    if (!executionContext.specialistIsEligible) {
      await this.pauseIneligibleJob(jobId, leaseToken);
      return;
    }

    if (
      executionContext.mode === 'SYNCHRONIZE' &&
      executionContext.syncConfirmed
    ) {
      try {
        await this.assertSynchronizationSnapshotCurrent(
          job,
          executionContext.syncPreviewSnapshot,
        );
      } catch (error) {
        if (await this.jobHasPersistedEffects(job)) {
          await this.markSynchronizationPartial(jobId, 0, leaseToken);
        } else {
          await this.markJobFailedUnlessTerminal(
            jobId,
            error?.message || 'Prévia de sincronização desatualizada',
            leaseToken,
          );
        }
        return;
      }
    }

    let reactivatedCount = job.items.filter(
      (item) =>
        (item.status === ProductImportItemStatus.COMPLETED ||
          item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS) &&
        Boolean(
          (item.payload as unknown as ImportItemPayload).__productImportEffect
            ?.reactivated,
        ),
    ).length;
    try {
      const seenProductIds = new Set<string>(
        job.items
          .filter(
            (item) =>
              (item.status === ProductImportItemStatus.COMPLETED ||
                item.status ===
                  ProductImportItemStatus.COMPLETED_WITH_WARNINGS ||
                item.status === ProductImportItemStatus.PROCESSING) &&
              item.product_id,
          )
          .map((item) => item.product_id as string),
      );
      let hasFailedItems = job.items.some(
        (item) => item.status === ProductImportItemStatus.FAILED,
      );

      for (const item of job.items) {
        this.throwIfJobLeaseLost(jobId, leaseToken);
        if (
          item.status !== ProductImportItemStatus.PENDING &&
          item.status !== ProductImportItemStatus.PROCESSING
        ) {
          continue;
        }

        try {
          const payload = item.payload as unknown as ImportItemPayload;
          const checkpointedEffect = payload.__productImportEffect;
          const upsertResult =
            item.status === ProductImportItemStatus.PROCESSING &&
            checkpointedEffect &&
            item.product_id === checkpointedEffect.productId &&
            item.action === checkpointedEffect.action
              ? checkpointedEffect
              : await this.checkpointProductUpsert(
                  job,
                  item,
                  payload,
                  leaseToken,
                );
          seenProductIds.add(upsertResult.productId);
          if (upsertResult.reactivated) {
            reactivatedCount += 1;
          }

          const warnings: string[] = [];
          const folderUrl = item.folder_url?.trim();

          if (folderUrl) {
            try {
              await this.extendJobLeaseForExternalEffect(jobId, leaseToken);
              const folderImportResult =
                await this.driveImportService.importImagesForProductFromFolder({
                  folder_url: folderUrl,
                  product_type: job.product_type,
                  product_id: upsertResult.productId,
                  assert_active: () =>
                    this.extendJobLeaseForExternalEffect(jobId, leaseToken),
                  import_job_fence: {
                    job_id: jobId,
                    lease_token: leaseToken,
                  },
                });

              if (
                folderImportResult.failed > 0 ||
                folderImportResult.warnings.length > 0
              ) {
                warnings.push(...folderImportResult.warnings);
              }
            } catch (driveError: any) {
              if (this.isJobLeaseLost(driveError)) throw driveError;
              warnings.push(
                `Aviso: falha ao importar imagens da pasta — ${driveError?.message || 'erro desconhecido'}`,
              );
            }
          }

          await this.updateImportItemWithLease(jobId, leaseToken, item.id, {
            status:
              warnings.length > 0
                ? ProductImportItemStatus.COMPLETED_WITH_WARNINGS
                : ProductImportItemStatus.COMPLETED,
            product_id: upsertResult.productId,
            action: upsertResult.action,
            warnings: warnings.length > 0 ? warnings : undefined,
            error_message: null,
            processed_at: new Date(),
          });
        } catch (error) {
          if (this.isJobLeaseLost(error)) throw error;
          hasFailedItems = true;
          await this.updateImportItemWithLease(jobId, leaseToken, item.id, {
            status: ProductImportItemStatus.FAILED,
            attempts: { increment: 1 },
            error_message:
              error?.message || 'Erro desconhecido no processamento da linha',
            processed_at: new Date(),
          });
        }
      }

      const shouldSynchronize =
        executionContext.mode === 'SYNCHRONIZE' &&
        executionContext.syncConfirmed &&
        !hasFailedItems;
      if (shouldSynchronize) {
        await this.finalizeSynchronizedJob(
          jobId,
          {
            productType: job.product_type,
            specialistId: job.specialist_id,
            seenProductIds,
            snapshot: executionContext.syncPreviewSnapshot,
          },
          reactivatedCount,
          leaseToken,
        );
      } else {
        await this.finalizeUnsynchronizedJob(
          jobId,
          { deactivatedIds: [], reactivatedCount },
          leaseToken,
        );
      }
    } catch (error) {
      if (this.isJobLeaseLost(error)) return;
      if (
        executionContext.mode === 'SYNCHRONIZE' &&
        (this.isSynchronizationPreviewStale(error) ||
          this.isSerializationFailure(error))
      ) {
        await this.markSynchronizationPartial(
          jobId,
          reactivatedCount,
          leaseToken,
        );
        return;
      }
      await this.markJobFailedUnlessTerminal(
        jobId,
        error?.message || 'Erro ao processar job de importação',
        leaseToken,
      );
    }
  }

  private async checkpointProductUpsert(
    job: { id: string; product_type: ProductType; specialist_id: string },
    item: { id: string },
    payload: ImportItemPayload,
    leaseToken: string,
  ): Promise<ProductImportEffect> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertJobLeaseOwned(tx, job.id, leaseToken);
      await tx.productImportJobItem.update({
        where: { id: item.id },
        data: {
          status: ProductImportItemStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });
      const result = await this.upsertProductFromRow(
        job.product_type,
        payload,
        job.specialist_id,
        tx,
      );
      const version = await this.getProductVersion(
        job.product_type,
        result.productId,
        tx,
      );
      const effect: ProductImportEffect = {
        productId: result.productId,
        action: result.action,
        rowVersion: version.rowVersion,
        updatedAt: version.updatedAt,
        ...(result.reactivated !== undefined
          ? { reactivated: result.reactivated }
          : {}),
      };
      await tx.productImportJobItem.update({
        where: { id: item.id },
        data: {
          status: ProductImportItemStatus.PROCESSING,
          product_id: effect.productId,
          action: effect.action,
          payload: {
            ...payload,
            __productImportEffect: effect,
          },
          error_message: null,
        },
      });
      return effect;
    });
  }

  private async updateImportItemWithLease(
    jobId: string,
    leaseToken: string,
    itemId: string,
    data: Prisma.ProductImportJobItemUpdateInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertJobLeaseOwned(tx, jobId, leaseToken);
      await tx.productImportJobItem.update({
        where: { id: itemId },
        data,
      });
    });
  }

  private async getProductVersion(
    productType: ProductType,
    productId: string,
    client: Prisma.TransactionClient,
  ): Promise<{ rowVersion: string; updatedAt: string }> {
    type VersionRow = { rowVersion: string; updatedAt: Date };
    const rows =
      productType === ProductType.CAR
        ? await client.$queryRaw<VersionRow[]>`
            SELECT xmin::text AS "rowVersion", "updated_at" AS "updatedAt"
            FROM "Car" WHERE "id" = ${productId}::uuid
          `
        : productType === ProductType.BOAT
          ? await client.$queryRaw<VersionRow[]>`
              SELECT xmin::text AS "rowVersion", "updated_at" AS "updatedAt"
              FROM "Boat" WHERE "id" = ${productId}::uuid
            `
          : await client.$queryRaw<VersionRow[]>`
              SELECT xmin::text AS "rowVersion", "updated_at" AS "updatedAt"
              FROM "Aircraft" WHERE "id" = ${productId}::uuid
            `;
    if (rows.length !== 1) {
      throw new NotFoundException('Produto importado não encontrado.');
    }
    return {
      rowVersion: rows[0].rowVersion,
      updatedAt: rows[0].updatedAt.toISOString(),
    };
  }

  private async markJobFailedUnlessTerminal(
    jobId: string,
    message: string,
    leaseToken: string,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "status" = ${ProductImportJobStatus.FAILED}::"ProductImportJobStatus",
          "error_message" = ${message},
          "finished_at" = NOW(),
          "updated_at" = NOW()
      WHERE "id" = ${jobId}::uuid
        AND "status" = ${ProductImportJobStatus.PROCESSING}::"ProductImportJobStatus"
        AND "processing_lease_token" = ${leaseToken}::uuid
        AND "processing_lease_expires_at" > NOW()
    `;
  }

  private async jobHasPersistedEffects(job: {
    id: string;
    product_type: ProductType;
    specialist_id: string;
    items: Array<{
      status: ProductImportItemStatus;
      product_id: string | null;
      payload: unknown;
    }>;
  }): Promise<boolean> {
    if (
      job.items.some(
        (item) =>
          item.status === ProductImportItemStatus.COMPLETED ||
          item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS ||
          (item.status === ProductImportItemStatus.PROCESSING &&
            Boolean(item.product_id) &&
            Boolean(
              (item.payload as unknown as ImportItemPayload)
                .__productImportEffect,
            )),
      )
    ) {
      return true;
    }
    const deactivatedIds = await this.getProductsDeactivatedByJob(
      job.product_type,
      job.specialist_id,
      job.id,
      this.prisma,
    );
    return deactivatedIds.length > 0;
  }

  private isSynchronizationPreviewStale(error: unknown): boolean {
    if (!(error instanceof ConflictException)) return false;
    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      response.code === 'SYNCHRONIZE_PREVIEW_STALE'
    );
  }

  private async markSynchronizationPartial(
    jobId: string,
    reactivatedCount: number,
    leaseToken: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertJobLeaseOwned(tx, jobId, leaseToken);
      const job = await tx.productImportJob.findUnique({
        where: { id: jobId },
        select: {
          status: true,
          product_type: true,
          specialist_id: true,
          reactivated_items: true,
        },
      });
      if (
        !job ||
        job.status === ProductImportJobStatus.COMPLETED ||
        job.status === ProductImportJobStatus.COMPLETED_WITH_ERRORS ||
        job.status === ProductImportJobStatus.FAILED
      ) {
        return;
      }
      await tx.productImportJobItem.updateMany({
        where: {
          job_id: jobId,
          status: ProductImportItemStatus.PROCESSING,
          product_id: { not: null },
        },
        data: {
          status: ProductImportItemStatus.COMPLETED_WITH_WARNINGS,
          warnings: [
            'O catálogo mudou após o checkpoint; confira a importação de imagens antes de gerar uma nova prévia.',
          ],
          processed_at: new Date(),
        },
      });
      const items = await tx.productImportJobItem.findMany({
        where: { job_id: jobId },
        select: {
          status: true,
          action: true,
          product_id: true,
        },
      });
      const completed = items.filter(
        (item) =>
          item.status === ProductImportItemStatus.COMPLETED ||
          item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS ||
          (item.status === ProductImportItemStatus.PROCESSING &&
            Boolean(item.product_id)),
      );
      const changedProductIds = completed
        .map((item) => item.product_id)
        .filter((id): id is string => Boolean(id));
      const insertedCount = completed.filter(
        (item) => item.action === 'CREATED',
      ).length;
      const updatedCount = completed.filter(
        (item) => item.action === 'UPDATED',
      ).length;
      const warningItems = completed.filter(
        (item) =>
          item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS,
      ).length;
      const failedItems = items.filter(
        (item) => item.status === ProductImportItemStatus.FAILED,
      ).length;
      const deactivatedIds = await this.getProductsDeactivatedByJob(
        job.product_type,
        job.specialist_id,
        jobId,
        tx,
      );
      const details = changedProductIds.length
        ? ` Produtos alterados: ${changedProductIds.join(', ')}.`
        : '';
      await tx.productImportJob.updateMany({
        where: {
          id: jobId,
          status: {
            in: [
              ProductImportJobStatus.PENDING,
              ProductImportJobStatus.PROCESSING,
            ],
          },
        },
        data: {
          status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
          total_items: items.length,
          processed_items: completed.length + failedItems,
          success_items: completed.length,
          warning_items: warningItems,
          failed_items: failedItems,
          deactivated_items: deactivatedIds.length,
          deactivated_product_ids: deactivatedIds,
          reactivated_items: Math.max(
            reactivatedCount,
            job.reactivated_items,
          ),
          error_message:
            `Importação parcial: ${insertedCount} inserido(s), ${updatedCount} atualizado(s). ` +
            `O catálogo mudou durante o processamento; nenhuma nova desativação foi aplicada` +
            `${deactivatedIds.length ? ` e ${deactivatedIds.length} desativação(ões) anterior(es) do job foi(ram) preservada(s)` : ''}. ` +
            `Gere uma nova prévia.${details}`,
          finished_at: new Date(),
        },
      });
    });
  }

  private async getJobExecutionContext(job: {
    id: string;
    specialist_id: string;
    product_type: ProductType;
  }): Promise<{
    mode: ProductImportMode;
    syncConfirmed: boolean;
    syncPreviewSnapshot: SynchronizePreviewSnapshot | null;
    specialistIsEligible: boolean;
  }> {
    const metadata = await this.prisma.$queryRaw<
      Array<{
        mode: string;
        sync_confirmed: boolean;
        sync_preview_snapshot: SynchronizePreviewSnapshot | null;
      }>
    >`
      SELECT "mode", "sync_confirmed", "sync_preview_snapshot"
      FROM "ProductImportJob"
      WHERE "id" = ${job.id}::uuid
    `;
    const specialist = await this.prisma.user.findUnique({
      where: { id: job.specialist_id },
      select: { role: true, is_active: true, speciality: true },
    });
    const row = metadata[0];
    return {
      mode: row?.mode === 'SYNCHRONIZE' ? 'SYNCHRONIZE' : 'ADDITIVE',
      syncConfirmed: row?.sync_confirmed === true,
      syncPreviewSnapshot: row?.sync_preview_snapshot ?? null,
      specialistIsEligible:
        specialist?.role === UserRole.SPECIALIST &&
        specialist.is_active === true &&
        specialist.speciality === job.product_type,
    };
  }

  private async estimateImportImpact(
    productType: ProductType,
    specialistId: string,
    rows: ImportParsedRow[],
    mode: ProductImportMode,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const snapshot = await this.getSynchronizationCatalogSnapshot(
      productType,
      specialistId,
      rows,
      client,
    );
    if (mode === 'SYNCHRONIZE') return snapshot.impact;
    return { ...snapshot.impact, deactivationCandidates: 0 };
  }

  private deriveImportImpact(
    activeItemsBefore: number,
    matchingItems: number,
    rows: ImportParsedRow[],
    deactivationCandidates: number,
  ): ImportImpact {
    const incomingIdentifiers = new Set(
      rows.map((row) => row.identificador?.trim()).filter(Boolean),
    );
    return {
      incomingItems: rows.length,
      activeItemsBefore,
      matchingItems,
      newOrReactivatedItems: Math.max(
        0,
        incomingIdentifiers.size - matchingItems,
      ),
      deactivationCandidates,
    };
  }

  private async getCatalogProductsByType(
    productType: ProductType,
    specialistId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<CatalogProductSnapshot[]> {
    type CatalogRow = {
      id: string;
      identificador: string;
      isActive: boolean;
      updatedAt: Date;
      rowVersion: string;
    };
    const rawClient = client as PrismaService;
    if (typeof rawClient.$queryRaw === 'function') {
      const rows =
        productType === ProductType.CAR
          ? await rawClient.$queryRaw<CatalogRow[]>`
              SELECT "id"::text AS "id", "identificador",
                     COALESCE("is_active", true) AS "isActive",
                     "updated_at" AS "updatedAt", xmin::text AS "rowVersion"
              FROM "Car" WHERE "specialist_id" = ${specialistId}::uuid
            `
          : productType === ProductType.BOAT
            ? await rawClient.$queryRaw<CatalogRow[]>`
                SELECT "id"::text AS "id", "identificador",
                       COALESCE("is_active", true) AS "isActive",
                       "updated_at" AS "updatedAt", xmin::text AS "rowVersion"
                FROM "Boat" WHERE "specialist_id" = ${specialistId}::uuid
              `
            : await rawClient.$queryRaw<CatalogRow[]>`
                SELECT "id"::text AS "id", "identificador",
                       COALESCE("is_active", true) AS "isActive",
                       "updated_at" AS "updatedAt", xmin::text AS "rowVersion"
                FROM "Aircraft" WHERE "specialist_id" = ${specialistId}::uuid
              `;
      return rows.map((product) => ({
        id: product.id,
        identificador: product.identificador,
        isActive: product.isActive,
        updatedAt: product.updatedAt.toISOString(),
        rowVersion: product.rowVersion,
      }));
    }

    // Doubles unitários simples não expõem query raw. Em execução real,
    // a consulta única acima captura dados e xmin no mesmo snapshot.
    const query = {
      where: { specialist_id: specialistId },
      select: {
        id: true,
        identificador: true,
        is_active: true,
        updated_at: true,
      },
    };
    let products: Array<{
      id: string;
      identificador: string;
      is_active: boolean;
      updated_at: Date;
    }>;
    if (productType === ProductType.CAR) {
      products = await (client as PrismaService).car.findMany(query);
    } else if (productType === ProductType.BOAT) {
      products = await (client as PrismaService).boat.findMany(query);
    } else {
      products = await (client as PrismaService).aircraft.findMany(query);
    }
    return products.map((product) => ({
      id: product.id,
      identificador: product.identificador,
      isActive: product.is_active ?? true,
      updatedAt:
        product.updated_at instanceof Date
          ? product.updated_at.toISOString()
          : '1970-01-01T00:00:00.000Z',
      rowVersion: `test-double:${product.id}:${
        product.updated_at instanceof Date
          ? product.updated_at.toISOString()
          : 'unknown'
      }`,
    }));
  }

  private async getActiveProductsByType(
    productType: ProductType,
    specialistId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<Array<{ id: string; identificador: string }>> {
    const products = await this.getCatalogProductsByType(
      productType,
      specialistId,
      client,
    );
    return products
      .filter((product) => product.isActive)
      .map(({ id, identificador }) => ({ id, identificador }));
  }

  private async refreshJobCounters(
    jobId: string,
    syncSummary?: { deactivatedIds: string[]; reactivatedCount: number },
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const items = await (client as PrismaService).productImportJobItem.findMany({
      where: { job_id: jobId },
      select: {
        status: true,
      },
    });

    const processedItems = items.filter(
      (item) =>
        item.status === ProductImportItemStatus.COMPLETED ||
        item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS ||
        item.status === ProductImportItemStatus.FAILED,
    ).length;

    const successItems = items.filter(
      (item) =>
        item.status === ProductImportItemStatus.COMPLETED ||
        item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS,
    ).length;

    const warningItems = items.filter(
      (item) => item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS,
    ).length;

    const failedItems = items.filter(
      (item) => item.status === ProductImportItemStatus.FAILED,
    ).length;

    const totalItems = items.length;

    let finalStatus: ProductImportJobStatus = ProductImportJobStatus.COMPLETED;

    if (failedItems > 0 && successItems > 0) {
      finalStatus = ProductImportJobStatus.COMPLETED_WITH_ERRORS;
    } else if (failedItems > 0 && successItems === 0) {
      finalStatus = ProductImportJobStatus.FAILED;
    }

    await (client as PrismaService).productImportJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        total_items: totalItems,
        processed_items: processedItems,
        success_items: successItems,
        warning_items: warningItems,
        failed_items: failedItems,
        deactivated_items: syncSummary?.deactivatedIds.length ?? 0,
        reactivated_items: syncSummary?.reactivatedCount ?? 0,
        deactivated_product_ids: syncSummary?.deactivatedIds ?? [],
        finished_at: new Date(),
      },
    });
  }

  private async finalizeUnsynchronizedJob(
    jobId: string,
    syncSummary: { deactivatedIds: string[]; reactivatedCount: number },
    leaseToken: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertJobLeaseOwned(tx, jobId, leaseToken);
      await this.refreshJobCounters(jobId, syncSummary, tx);
    });
  }

  private async finalizeSynchronizedJob(
    jobId: string,
    input: {
      productType: ProductType;
      specialistId: string;
      seenProductIds: Set<string>;
      snapshot: SynchronizePreviewSnapshot | null;
    },
    reactivatedCount: number,
    leaseToken: string,
  ): Promise<void> {
    await this.runSerializableWithRetry(async (tx) => {
      await this.assertJobLeaseOwned(tx, jobId, leaseToken);
      await this.lockProductCatalogForSnapshot(tx, input.productType);
      const items = await tx.productImportJobItem.findMany({
        where: { job_id: jobId },
        select: {
          status: true,
          action: true,
          product_id: true,
          payload: true,
        },
      });
      await this.assertLogicalCatalogMatches(
        input.productType,
        input.specialistId,
        jobId,
        input.snapshot,
        items,
        tx,
      );
      const deactivatedIds = await this.deactivateMissingProducts(
        input.productType,
        input.specialistId,
        input.seenProductIds,
        jobId,
        input.snapshot,
        tx,
      );
      await this.refreshJobCounters(
        jobId,
        { deactivatedIds, reactivatedCount },
        tx,
      );
    });
  }

  private async lockProductCatalogForSnapshot(
    tx: Prisma.TransactionClient,
    productType: ProductType,
  ): Promise<void> {
    if (productType === ProductType.CAR) {
      await tx.$executeRaw`LOCK TABLE "Car" IN SHARE ROW EXCLUSIVE MODE`;
    } else if (productType === ProductType.BOAT) {
      await tx.$executeRaw`LOCK TABLE "Boat" IN SHARE ROW EXCLUSIVE MODE`;
    } else {
      await tx.$executeRaw`LOCK TABLE "Aircraft" IN SHARE ROW EXCLUSIVE MODE`;
    }
  }

  private async assertSynchronizationSnapshotCurrent(
    job: {
      id: string;
      product_type: ProductType;
      specialist_id: string;
      items: Array<{
        payload: unknown;
        status: ProductImportItemStatus;
        action: string | null;
        product_id: string | null;
      }>;
    },
    snapshot: SynchronizePreviewSnapshot | null,
  ): Promise<void> {
    if (!snapshot) {
      throw this.synchronizePreviewStale();
    }
    const incomingIdentifiers = new Set(
      job.items
        .map((item) => {
          const row = item.payload as unknown as ImportParsedRow;
          return row.identificador?.trim();
        })
        .filter(Boolean),
    );
    await this.runSerializableWithRetry(async (tx) => {
      await this.assertLogicalCatalogMatches(
        job.product_type,
        job.specialist_id,
        job.id,
        snapshot,
        job.items,
        tx,
      );
      const activeProducts = await this.getActiveProductsByType(
        job.product_type,
        job.specialist_id,
        tx,
      );
      const alreadyDeactivatedIds = await this.getProductsDeactivatedByJob(
        job.product_type,
        job.specialist_id,
        job.id,
        tx,
      );
      const currentCandidateIds = [
        ...activeProducts
          .filter(
            (product) => !incomingIdentifiers.has(product.identificador),
          )
          .map((product) => product.id),
        ...alreadyDeactivatedIds,
      ].sort();
      this.assertCandidateIdsMatch(
        currentCandidateIds,
        snapshot.candidateIds,
      );
    });
  }

  private async assertLogicalCatalogMatches(
    productType: ProductType,
    specialistId: string,
    jobId: string,
    snapshot: SynchronizePreviewSnapshot | null,
    items: Array<{
      status: ProductImportItemStatus;
      action: string | null;
      product_id: string | null;
      payload: unknown;
    }>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (
      !snapshot?.catalogDigest ||
      !Array.isArray(snapshot.catalogProducts)
    ) {
      throw this.synchronizePreviewStale();
    }
    const currentCatalog = await this.getCatalogProductsByType(
      productType,
      specialistId,
      tx,
    );
    const originals = new Map(
      snapshot.catalogProducts.map((product) => [product.id, product]),
    );
    const checkpointedItems = items.filter(
      (item) =>
        item.status === ProductImportItemStatus.COMPLETED ||
        item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS ||
        item.status === ProductImportItemStatus.PROCESSING,
    );
    const effects = new Map<string, ProductImportEffect>();
    for (const item of checkpointedItems) {
      const effect = (item.payload as unknown as ImportItemPayload)
        .__productImportEffect;
      if (
        effect &&
        item.product_id === effect.productId &&
        item.action === effect.action
      ) {
        effects.set(effect.productId, effect);
      }
    }
    const currentProducts = new Map(
      currentCatalog.map((product) => [product.id, product]),
    );
    for (const effect of effects.values()) {
      if (
        effect.action === 'CREATED' &&
        (!currentProducts.has(effect.productId) ||
          currentProducts.get(effect.productId)?.rowVersion !==
            effect.rowVersion)
      ) {
        // Produto criado pelo CSV removido/alterado depois do checkpoint não
        // existia no snapshot original e, sem esta guarda, desapareceria do
        // catálogo lógico sem invalidar a sincronização.
        throw this.synchronizePreviewStale();
      }
    }
    const alreadyDeactivatedIds = new Set(
      await this.getProductsDeactivatedByJob(
        productType,
        specialistId,
        jobId,
        tx,
      ),
    );
    const logicalCatalog: CatalogProductSnapshot[] = [];
    for (const product of currentCatalog) {
      const effect = effects.get(product.id);
      const wasDeactivatedByJob = alreadyDeactivatedIds.has(product.id);
      if (!effect && !wasDeactivatedByJob) {
        logicalCatalog.push(product);
        continue;
      }
      const original = originals.get(product.id);
      if (wasDeactivatedByJob) {
        if (original) logicalCatalog.push(original);
      } else if (effect && product.rowVersion !== effect.rowVersion) {
        // Mudança posterior ao checkpoint não pertence a este job.
        logicalCatalog.push(product);
      } else if (original) {
        logicalCatalog.push(original);
      } else if (effect?.action !== 'CREATED') {
        // Um UPDATED desconhecido não pode ser atribuído ao job com segurança.
        logicalCatalog.push(product);
      }
    }
    if (this.catalogDigest(logicalCatalog) !== snapshot.catalogDigest) {
      throw this.synchronizePreviewStale();
    }
  }

  private async deactivateMissingProducts(
    productType: ProductType,
    specialistId: string,
    seenProductIds: Set<string>,
    jobId: string,
    snapshot: SynchronizePreviewSnapshot | null,
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    if (!snapshot) {
      throw this.synchronizePreviewStale();
    }
    const activeProducts = await this.getActiveProductsByType(
      productType,
      specialistId,
      tx,
    );
    const alreadyDeactivatedIds = await this.getProductsDeactivatedByJob(
      productType,
      specialistId,
      jobId,
      tx,
    );
    const currentCandidateIds = [
      ...activeProducts
        .map((product) => product.id)
        .filter((id) => !seenProductIds.has(id)),
      ...alreadyDeactivatedIds,
    ].sort();
    const expectedCandidateIds = [...snapshot.candidateIds].sort();
    this.assertCandidateIdsMatch(currentCandidateIds, expectedCandidateIds);
    if (expectedCandidateIds.length === 0) {
      return [];
    }

    const data = {
      is_active: false,
      deactivated_at: new Date(),
      deactivated_by_sync_job_id: jobId,
    };

    if (productType === ProductType.CAR) {
      await tx.car.updateMany({
        where: {
          id: { in: expectedCandidateIds },
          specialist_id: specialistId,
          is_active: true,
        },
        data,
      });
    } else if (productType === ProductType.BOAT) {
      await tx.boat.updateMany({
        where: {
          id: { in: expectedCandidateIds },
          specialist_id: specialistId,
          is_active: true,
        },
        data,
      });
    } else {
      await tx.aircraft.updateMany({
        where: {
          id: { in: expectedCandidateIds },
          specialist_id: specialistId,
          is_active: true,
        },
        data,
      });
    }
    return expectedCandidateIds;
  }

  private async getProductsDeactivatedByJob(
    productType: ProductType,
    specialistId: string,
    jobId: string,
    client: PrismaService | Prisma.TransactionClient,
  ): Promise<string[]> {
    const query = {
      where: {
        specialist_id: specialistId,
        is_active: false,
        deactivated_by_sync_job_id: jobId,
      },
      select: { id: true },
    };
    if (productType === ProductType.CAR) {
      return (await (client as PrismaService).car.findMany(query)).map(
        ({ id }) => id,
      );
    }
    if (productType === ProductType.BOAT) {
      return (await (client as PrismaService).boat.findMany(query)).map(
        ({ id }) => id,
      );
    }
    return (await (client as PrismaService).aircraft.findMany(query)).map(
      ({ id }) => id,
    );
  }

  private assertCandidateIdsMatch(
    currentCandidateIds: string[],
    expectedCandidateIds: string[],
  ): void {
    const current = [...currentCandidateIds].sort();
    const expected = [...expectedCandidateIds].sort();
    if (
      current.length !== expected.length ||
      current.some((id, index) => id !== expected[index])
    ) {
      throw this.synchronizePreviewStale();
    }
  }

  private synchronizePreviewStale(): ConflictException {
    return new ConflictException({
      code: 'SYNCHRONIZE_PREVIEW_STALE',
      message:
        'O catálogo mudou desde a prévia. Nenhum produto foi desativado; gere uma nova prévia.',
    });
  }

  private async getActiveProductIdsByType(
    productType: ProductType,
    specialistId: string,
  ): Promise<string[]> {
    if (productType === ProductType.CAR) {
      const cars = await this.prisma.car.findMany({
        where: { specialist_id: specialistId, is_active: true },
        select: { id: true },
      });
      return cars.map((item) => item.id);
    }

    if (productType === ProductType.BOAT) {
      const boats = await this.prisma.boat.findMany({
        where: { specialist_id: specialistId, is_active: true },
        select: { id: true },
      });
      return boats.map((item) => item.id);
    }

    const aircrafts = await this.prisma.aircraft.findMany({
      where: { specialist_id: specialistId, is_active: true },
      select: { id: true },
    });
    return aircrafts.map((item) => item.id);
  }

  private async upsertProductFromRow(
    productType: ProductType,
    row: ImportParsedRow,
    specialistId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<UpsertResult> {
    row = this.normalizeProductRow(row);
    this.validateRequiredProductFields(row);

    // Normaliza uma vez só: a busca do produto existente usava o valor com
    // trim e a gravação usava o valor cru, então " ABC " seria gravado como
    // " ABC " e nunca mais reencontrado — cada reimport criaria uma duplicata.
    // Hoje o parseCsv já entrega tudo trimado, mas a divergência ficava
    // armada para qualquer chamador que não passe pelo CSV.
    const identificador = row.identificador;

    if (productType === ProductType.CAR) {
      const data = {
        marca: row.marca || undefined,
        modelo: row.modelo || undefined,
        identificador,
        valor: Number(row.valor),
        currency: row.currency.toUpperCase() as ProductCurrency,
        estado: row.estado || undefined,
        ano: row.ano ? Number(row.ano) : undefined,
        cor: row.cor || undefined,
        km: row.km ? Number(row.km) : undefined,
        cambio: row.cambio || undefined,
        combustivel: row.combustivel || undefined,
        tipo_categoria: row.tipo_categoria || undefined,
        descricao: row.descricao || undefined,
        specialist_id: specialistId,
      };

      const createData = this.withCreationDefaults(ProductType.CAR, data);
      await this.validatePayload(createData, CreateCarDto);

      const existing = await (client as PrismaService).car.findFirst({
        where: {
          specialist_id: specialistId,
          identificador,
        },
      });

      if (existing) {
        const { specialist_id: _specialistId, ...updateData } = data;
        const reactivated = !existing.is_active;
        const updated = (await updateProductWithMonetaryLock(client, {
          productType: ProductType.CAR,
          productId: existing.id,
          nextValue: data.valor,
          nextCurrency: data.currency,
          data: {
            ...updateData,
            is_active: true,
            deactivated_at: null,
            deactivated_by_sync_job_id: null,
          },
        })) as { updated_at?: Date };

        return {
          productId: existing.id,
          action: 'UPDATED',
          reactivated,
          updatedAt: updated.updated_at?.toISOString(),
        };
      }

      const created = await (client as PrismaService).car.create({ data: createData });
      return {
        productId: created.id,
        action: 'CREATED',
        updatedAt: created.updated_at?.toISOString(),
      };
    }

    if (productType === ProductType.BOAT) {
      const data = {
        marca: row.marca || undefined,
        modelo: row.modelo || undefined,
        identificador,
        valor: Number(row.valor),
        currency: row.currency.toUpperCase() as ProductCurrency,
        estado: row.estado || undefined,
        ano: row.ano ? Number(row.ano) : undefined,
        fabricante: row.fabricante || undefined,
        tamanho: row.tamanho || undefined,
        estilo: row.estilo || undefined,
        combustivel: row.combustivel || undefined,
        motor: row.motor || undefined,
        ano_motor: row.ano_motor ? Number(row.ano_motor) : undefined,
        tipo_embarcacao: row.tipo_embarcacao || undefined,
        descricao_completa: row.descricao_completa || undefined,
        acessorios: row.acessorios || undefined,
        specialist_id: specialistId,
      };

      const createData = this.withCreationDefaults(ProductType.BOAT, data);
      await this.validatePayload(createData, CreateBoatDto);

      const existing = await (client as PrismaService).boat.findFirst({
        where: {
          specialist_id: specialistId,
          identificador,
        },
      });

      if (existing) {
        const { specialist_id: _specialistId, ...updateData } = data;
        const reactivated = !existing.is_active;
        const updated = (await updateProductWithMonetaryLock(client, {
          productType: ProductType.BOAT,
          productId: existing.id,
          nextValue: data.valor,
          nextCurrency: data.currency,
          data: {
            ...updateData,
            is_active: true,
            deactivated_at: null,
            deactivated_by_sync_job_id: null,
          },
        })) as { updated_at?: Date };

        return {
          productId: existing.id,
          action: 'UPDATED',
          reactivated,
          updatedAt: updated.updated_at?.toISOString(),
        };
      }

      const created = await (client as PrismaService).boat.create({ data: createData });
      return {
        productId: created.id,
        action: 'CREATED',
        updatedAt: created.updated_at?.toISOString(),
      };
    }

    const data = {
      marca: row.marca || undefined,
      modelo: row.modelo || undefined,
      identificador,
      valor: Number(row.valor),
      currency: row.currency.toUpperCase() as ProductCurrency,
      estado: row.estado || undefined,
      ano: row.ano ? Number(row.ano) : undefined,
      categoria: row.categoria || undefined,
      assentos: row.assentos ? Number(row.assentos) : undefined,
      tipo_aeronave: row.tipo_aeronave || undefined,
      descricao: row.descricao || undefined,
      specialist_id: specialistId,
    };

    const createData = this.withCreationDefaults(ProductType.AIRCRAFT, data);
    await this.validatePayload(createData, CreateAircraftDto);

    const existing = await (client as PrismaService).aircraft.findFirst({
      where: {
        specialist_id: specialistId,
        identificador,
      },
    });

    if (existing) {
      const { specialist_id: _specialistId, ...updateData } = data;
      const reactivated = !existing.is_active;
      const updated = (await updateProductWithMonetaryLock(client, {
        productType: ProductType.AIRCRAFT,
        productId: existing.id,
        nextValue: data.valor,
        nextCurrency: data.currency,
        data: {
          ...updateData,
          is_active: true,
          deactivated_at: null,
          deactivated_by_sync_job_id: null,
        },
      })) as { updated_at?: Date };

      return {
        productId: existing.id,
        action: 'UPDATED',
        reactivated,
        updatedAt: updated.updated_at?.toISOString(),
      };
    }

    const created = await (client as PrismaService).aircraft.create({ data: createData });
    return {
      productId: created.id,
      action: 'CREATED',
      updatedAt: created.updated_at?.toISOString(),
    };
  }

  private normalizeProductRow(row: ImportParsedRow): ImportParsedRow {
    return Object.fromEntries(
      Object.entries(row).map(([key, rawValue]) => {
        const value = String(rawValue ?? '').trim();
        return [key, value === '-' ? '' : value];
      }),
    );
  }

  /**
   * Lê .xlsx (o modelo baixado) ou .csv, valida o cabeçalho e devolve as
   * linhas normalizadas, já com identificador. Todo o resto do import (prévia,
   * sincronização, payload dos itens) usa estas linhas.
   */
  getImportTemplate(productType: ProductType): Promise<Buffer> {
    return this.xlsxImportService.generateTemplate(
      this.getColumnsForType(productType),
    );
  }

  private async parseImportRows(
    fileBuffer: Buffer,
    productType: ProductType,
  ): Promise<ImportParsedRow[]> {
    // .xlsx é um zip: começa com "PK".
    const isXlsx = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b;
    const { rows } = isXlsx
      ? await this.xlsxImportService.parseWorkbook(fileBuffer)
      : this.xlsxImportService.parseCsv(fileBuffer);
    const columns = this.getColumnsForType(productType);
    const structureValidation = this.xlsxImportService.validateStructure(
      rows,
      columns,
    );
    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura da planilha inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }
    const normalizedRows = rows.map((row) =>
      this.withIdentifier(productType, this.normalizeProductRow(row), columns),
    );
    this.validateUniqueIdentifiers(normalizedRows);
    return normalizedRows;
  }

  /**
   * Linha sem identificador ganha um derivado dos dados descritivos, para que
   * reimportar a mesma linha atualize o produto em vez de duplicar.
   * ponytail: mudar um dado descritivo (marca, km...) numa linha sem
   * identificador gera outro id e cria um produto novo; a aba Instruções
   * orienta a preencher o identificador quando a linha for editada depois.
   */
  private withIdentifier(
    productType: ProductType,
    row: ImportParsedRow,
    columns: XlsxColumnDefinition[],
  ): ImportParsedRow {
    if (row.identificador) return row;
    const descriptive = columns
      .map((column) => column.name)
      .filter((name) => !NON_DESCRIPTIVE_COLUMNS.has(name) && row[name])
      .map((name) => [name, row[name].toLowerCase()]);
    // Sem nenhum dado descritivo, só o preço distingue uma linha da outra.
    const basis = descriptive.length
      ? descriptive
      : [
          ['valor', row.valor],
          ['currency', row.currency?.toUpperCase()],
        ];
    const hash = this.sha256(JSON.stringify([productType, basis])).slice(0, 12);
    return { ...row, identificador: `${AUTO_IDENTIFIER_PREFIX}${hash}` };
  }

  private withCreationDefaults<
    T extends {
      identificador: string;
      marca?: string;
      modelo?: string;
      estado?: string;
    },
  >(
    productType: ProductType,
    data: T,
  ): T & { marca: string; modelo: string; estado: string } {
    return {
      ...data,
      marca: data.marca ?? DEFAULT_MARCA[productType],
      modelo: data.modelo ?? data.identificador,
      estado: data.estado ?? DEFAULT_ESTADO,
    };
  }

  private validateUniqueIdentifiers(rows: ImportParsedRow[]): void {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of rows) {
      const identifier = row.identificador?.trim();
      if (!identifier) continue;
      if (seen.has(identifier)) duplicates.add(identifier);
      seen.add(identifier);
    }
    if (duplicates.size === 0) return;
    const manual = [...duplicates].filter(
      (id) => !id.startsWith(AUTO_IDENTIFIER_PREFIX),
    );
    throw new BadRequestException(
      manual.length > 0
        ? `A planilha contém identificadores duplicados: ${manual.join(', ')}.`
        : 'A planilha contém linhas sem identificador com os mesmos dados. Preencha o identificador para diferenciá-las.',
    );
  }

  private validateRequiredProductFields(row: ImportParsedRow): void {
    const missingFields = REQUIRED_PRODUCT_FIELDS.filter(
      ({ key }) => !row[key],
    );

    if (missingFields.length === 0) {
      this.validateCurrency(row);
      return;
    }

    throw new BadRequestException(
      missingFields.map(({ label }) => `${label} faltando`).join('; '),
    );
  }

  private validateCurrency(row: ImportParsedRow): void {
    const currency = row.currency.toUpperCase();
    if (currency !== ProductCurrency.BRL && currency !== ProductCurrency.USD) {
      throw new BadRequestException(
        `Moeda inválida "${row.currency}": use BRL ou USD.`,
      );
    }
  }

  private async validatePayload<T extends object>(
    payload: Record<string, unknown>,
    dtoClass: new () => T,
  ) {
    const dto = plainToInstance(dtoClass, payload, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto, { whitelist: true });

    if (errors.length === 0) {
      return;
    }

    const messages = errors.map((error) => {
      const constraints = error.constraints
        ? Object.values(error.constraints)
        : [];
      return `${error.property}: ${constraints.join(', ')}`;
    });

    throw new BadRequestException(messages.join('; '));
  }

  private buildImportResponse(
    items: Array<{
      row_number: number;
      status: ProductImportItemStatus;
      payload: unknown;
      action: string | null;
      product_id: string | null;
      error_message: string | null;
      warnings: unknown;
    }>,
    syncSummary?: { deactivatedIds: string[]; reactivatedCount: number },
  ): ImportResponseDto {
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const errorRows: ImportErrorRow[] = [];
    const warningRows: ImportErrorRow[] = [];

    for (const item of items) {
      if (
        item.status === ProductImportItemStatus.COMPLETED ||
        item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS
      ) {
        if (item.action === 'CREATED' && item.product_id) {
          insertedIds.push(item.product_id);
        }

        if (item.action === 'UPDATED' && item.product_id) {
          updatedIds.push(item.product_id);
        }
      }

      if (item.status === ProductImportItemStatus.FAILED) {
        errorRows.push({
          row: item.row_number,
          reason: item.error_message || 'Erro desconhecido',
          fields: (item.payload as Record<string, unknown>) || {},
        });
      }

      if (item.status === ProductImportItemStatus.COMPLETED_WITH_WARNINGS) {
        warningRows.push({
          row: item.row_number,
          reason: 'Produto processado com avisos de importação de imagem',
          fields: (item.payload as Record<string, unknown>) || {},
          imageWarnings: Array.isArray(item.warnings)
            ? (item.warnings as string[])
            : [],
        });
      }
    }

    const insertedCount = insertedIds.length;
    const updatedCount = updatedIds.length;
    const errorCount = errorRows.length;
    const warningCount = warningRows.length;
    const deactivatedIds = syncSummary?.deactivatedIds ?? [];
    const deactivatedCount = deactivatedIds.length;
    const reactivatedCount = syncSummary?.reactivatedCount ?? 0;

    let message = 'Importação em andamento.';
    let success = true;

    if (errorCount === 0 && insertedCount + updatedCount > 0) {
      message = `Importação concluída com sucesso. ${insertedCount} inserido(s), ${updatedCount} atualizado(s), ${deactivatedCount} inativado(s).`;
    }

    if (errorCount > 0 && insertedCount + updatedCount > 0) {
      message = `Importação parcial. ${insertedCount} inserido(s), ${updatedCount} atualizado(s), ${deactivatedCount} inativado(s), ${errorCount} erro(s).`;
    }

    if (errorCount > 0 && insertedCount + updatedCount === 0) {
      success = false;
      message = `Importação falhou. ${errorCount} erro(s) encontrado(s).`;
    }

    return {
      success,
      message,
      insertedCount,
      updatedCount,
      errorCount,
      warningCount,
      errorRows,
      warningRows,
      insertedIds,
      updatedIds,
      deactivatedCount,
      deactivatedIds,
      reactivatedCount,
    };
  }

  private getColumnsForType(productType: ProductType): XlsxColumnDefinition[] {
    if (productType === ProductType.CAR) {
      return CAR_COLUMNS;
    }

    if (productType === ProductType.BOAT) {
      return BOAT_COLUMNS;
    }

    return AIRCRAFT_COLUMNS;
  }
}
