import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ProductImportItemStatus,
  ProductImportJobStatus,
  ProductType,
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
import { CreateCarDto } from '../cars/dto/create-car.dto';
import { CreateBoatDto } from '../boats/dto/create-boat.dto';
import { CreateAircraftDto } from '../aircrafts/dto/create-aircraft.dto';
import { DriveImportService } from '../drive-import/drive-import.service';

type UpsertResult = {
  productId: number;
  action: 'CREATED' | 'UPDATED';
};

@Injectable()
export class ProductImportJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductImportJobsService.name);
  private readonly runningJobs = new Set<string>();
  private recoveryTimer?: NodeJS.Timeout;

  private readonly carColumns: XlsxColumnDefinition[] = [
    { name: 'marca', required: true, type: 'string' },
    { name: 'modelo', required: true, type: 'string' },
    { name: 'valor', required: true, type: 'number' },
    { name: 'estado', required: true, type: 'string' },
    { name: 'ano', required: true, type: 'number' },
    { name: 'cor', required: false, type: 'string' },
    { name: 'km', required: false, type: 'number' },
    { name: 'cambio', required: false, type: 'string' },
    { name: 'combustivel', required: false, type: 'string' },
    { name: 'tipo_categoria', required: false, type: 'string' },
    { name: 'descricao', required: false, type: 'string' },
    { name: 'folder_url', required: false, type: 'string' },
  ];

  private readonly boatColumns: XlsxColumnDefinition[] = [
    { name: 'marca', required: true, type: 'string' },
    { name: 'modelo', required: true, type: 'string' },
    { name: 'valor', required: true, type: 'number' },
    { name: 'estado', required: true, type: 'string' },
    { name: 'ano', required: true, type: 'number' },
    { name: 'fabricante', required: false, type: 'string' },
    { name: 'tamanho', required: false, type: 'string' },
    { name: 'estilo', required: false, type: 'string' },
    { name: 'combustivel', required: false, type: 'string' },
    { name: 'motor', required: false, type: 'string' },
    { name: 'ano_motor', required: false, type: 'number' },
    { name: 'tipo_embarcacao', required: false, type: 'string' },
    { name: 'descricao_completa', required: false, type: 'string' },
    { name: 'acessorios', required: false, type: 'string' },
    { name: 'folder_url', required: false, type: 'string' },
  ];

  private readonly aircraftColumns: XlsxColumnDefinition[] = [
    { name: 'marca', required: true, type: 'string' },
    { name: 'modelo', required: true, type: 'string' },
    { name: 'valor', required: true, type: 'number' },
    { name: 'estado', required: true, type: 'string' },
    { name: 'ano', required: true, type: 'number' },
    { name: 'categoria', required: false, type: 'string' },
    { name: 'assentos', required: false, type: 'number' },
    { name: 'tipo_aeronave', required: false, type: 'string' },
    { name: 'descricao', required: false, type: 'string' },
    { name: 'folder_url', required: false, type: 'string' },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly xlsxImportService: XlsxImportService,
    private readonly driveImportService: DriveImportService,
  ) {}

  private isMissingImportJobsTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021' &&
      `${error.meta?.table ?? ''}`.includes('ProductImportJob')
    );
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
  ) {
    const { rows } = this.xlsxImportService.parseCsv(fileBuffer);

    const structureValidation = this.xlsxImportService.validateStructure(
      rows,
      this.getColumnsForType(productType),
    );

    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura do CSV inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    let createdJob;
    try {
      createdJob = await this.prisma.productImportJob.create({
        data: {
          product_type: productType,
          specialist_id: user.id,
          status: ProductImportJobStatus.PENDING,
          total_items: rows.length,
          items: {
            createMany: {
              data: rows.map((row, index) => ({
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
    } catch (error) {
      if (this.isMissingImportJobsTableError(error)) {
        throw new BadRequestException(
          'A importação assíncrona ainda não está disponível neste ambiente. Aplique as migrations pendentes e tente novamente.',
        );
      }
      throw error;
    }

    this.scheduleJob(createdJob.id);

    return {
      jobId: createdJob.id,
      status: createdJob.status,
      productType: createdJob.product_type,
      totalItems: createdJob.total_items,
      pollIntervalMs: 2000,
      message: 'Importação recebida e iniciada em segundo plano.',
    };
  }

  async getJobStatus(jobId: string, user: UserEntity) {
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

    const response = this.buildImportResponse(job.items);

    return {
      jobId: job.id,
      status: job.status,
      productType: job.product_type,
      totalItems: job.total_items,
      processedItems: job.processed_items,
      successItems: job.success_items,
      warningItems: job.warning_items,
      failedItems: job.failed_items,
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

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: {
        status: ProductImportJobStatus.PROCESSING,
        started_at: job.started_at ?? new Date(),
        error_message: null,
      },
    });

    try {
      for (const item of job.items) {
        if (
          item.status !== ProductImportItemStatus.PENDING &&
          item.status !== ProductImportItemStatus.PROCESSING
        ) {
          continue;
        }

        await this.prisma.productImportJobItem.update({
          where: { id: item.id },
          data: {
            status: ProductImportItemStatus.PROCESSING,
            attempts: { increment: 1 },
          },
        });

        try {
          const row = item.payload as unknown as ImportParsedRow;
          const upsertResult = await this.upsertProductFromRow(
            job.product_type,
            row,
            job.specialist_id,
          );

          const warnings: string[] = [];
          const folderUrl = item.folder_url?.trim();

          if (folderUrl) {
            const folderImportResult =
              await this.driveImportService.importImagesForProductFromFolder({
                folder_url: folderUrl,
                product_type: job.product_type,
                product_id: upsertResult.productId,
              });

            if (
              folderImportResult.failed > 0 ||
              folderImportResult.skipped > 0
            ) {
              warnings.push(...folderImportResult.warnings);
            }
          }

          await this.prisma.productImportJobItem.update({
            where: { id: item.id },
            data: {
              status:
                warnings.length > 0
                  ? ProductImportItemStatus.COMPLETED_WITH_WARNINGS
                  : ProductImportItemStatus.COMPLETED,
              product_id: upsertResult.productId,
              action: upsertResult.action,
              warnings: warnings.length > 0 ? warnings : undefined,
              error_message: null,
              processed_at: new Date(),
            },
          });
        } catch (error) {
          await this.prisma.productImportJobItem.update({
            where: { id: item.id },
            data: {
              status: ProductImportItemStatus.FAILED,
              error_message:
                error?.message || 'Erro desconhecido no processamento da linha',
              processed_at: new Date(),
            },
          });
        }
      }

      await this.refreshJobCounters(jobId);
    } catch (error) {
      await this.prisma.productImportJob.update({
        where: { id: jobId },
        data: {
          status: ProductImportJobStatus.FAILED,
          error_message:
            error?.message || 'Erro ao processar job de importação',
          finished_at: new Date(),
        },
      });
    }
  }

  private async refreshJobCounters(jobId: string) {
    const items = await this.prisma.productImportJobItem.findMany({
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

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        total_items: totalItems,
        processed_items: processedItems,
        success_items: successItems,
        warning_items: warningItems,
        failed_items: failedItems,
        finished_at: new Date(),
      },
    });
  }

  private async upsertProductFromRow(
    productType: ProductType,
    row: ImportParsedRow,
    specialistId: string,
  ): Promise<UpsertResult> {
    if (productType === ProductType.CAR) {
      const data = {
        marca: row.marca,
        modelo: row.modelo,
        valor: Number(row.valor),
        estado: row.estado,
        ano: Number(row.ano),
        cor: row.cor || undefined,
        km: row.km ? Number(row.km) : undefined,
        cambio: row.cambio || undefined,
        combustivel: row.combustivel || undefined,
        tipo_categoria: row.tipo_categoria || undefined,
        descricao: row.descricao || undefined,
        specialist_id: specialistId,
      };

      await this.validatePayload(data, CreateCarDto);

      const existing = await this.prisma.car.findFirst({
        where: {
          marca: row.marca?.trim(),
          modelo: row.modelo?.trim(),
          specialist_id: specialistId,
        },
      });

      if (existing) {
        const { specialist_id, ...updateData } = data;
        await this.prisma.car.update({
          where: { id: existing.id },
          data: updateData,
        });

        return { productId: existing.id, action: 'UPDATED' };
      }

      const created = await this.prisma.car.create({ data });
      return { productId: created.id, action: 'CREATED' };
    }

    if (productType === ProductType.BOAT) {
      const data = {
        marca: row.marca,
        modelo: row.modelo,
        valor: Number(row.valor),
        estado: row.estado,
        ano: Number(row.ano),
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

      await this.validatePayload(data, CreateBoatDto);

      const existing = await this.prisma.boat.findFirst({
        where: {
          marca: row.marca?.trim(),
          modelo: row.modelo?.trim(),
          specialist_id: specialistId,
        },
      });

      if (existing) {
        const { specialist_id, ...updateData } = data;
        await this.prisma.boat.update({
          where: { id: existing.id },
          data: updateData,
        });

        return { productId: existing.id, action: 'UPDATED' };
      }

      const created = await this.prisma.boat.create({ data });
      return { productId: created.id, action: 'CREATED' };
    }

    const data = {
      marca: row.marca,
      modelo: row.modelo,
      valor: Number(row.valor),
      estado: row.estado,
      ano: Number(row.ano),
      categoria: row.categoria || undefined,
      assentos: row.assentos ? Number(row.assentos) : undefined,
      tipo_aeronave: row.tipo_aeronave || undefined,
      descricao: row.descricao || undefined,
      specialist_id: specialistId,
    };

    await this.validatePayload(data, CreateAircraftDto);

    const existing = await this.prisma.aircraft.findFirst({
      where: {
        marca: row.marca?.trim(),
        modelo: row.modelo?.trim(),
        specialist_id: specialistId,
      },
    });

    if (existing) {
      const { specialist_id, ...updateData } = data;
      await this.prisma.aircraft.update({
        where: { id: existing.id },
        data: updateData,
      });

      return { productId: existing.id, action: 'UPDATED' };
    }

    const created = await this.prisma.aircraft.create({ data });
    return { productId: created.id, action: 'CREATED' };
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
      product_id: number | null;
      error_message: string | null;
      warnings: unknown;
    }>,
  ): ImportResponseDto {
    const insertedIds: number[] = [];
    const updatedIds: number[] = [];
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

    let message = 'Importação em andamento.';
    let success = true;

    if (errorCount === 0 && insertedCount + updatedCount > 0) {
      message = `Importação concluída com sucesso. ${insertedCount} inserido(s), ${updatedCount} atualizado(s).`;
    }

    if (errorCount > 0 && insertedCount + updatedCount > 0) {
      message = `Importação parcial. ${insertedCount} inserido(s), ${updatedCount} atualizado(s), ${errorCount} erro(s).`;
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
    };
  }

  private getColumnsForType(productType: ProductType): XlsxColumnDefinition[] {
    if (productType === ProductType.CAR) {
      return this.carColumns;
    }

    if (productType === ProductType.BOAT) {
      return this.boatColumns;
    }

    return this.aircraftColumns;
  }
}
