import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductType, UserRole } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { ImportDriveImagesDto } from './dto/import-drive-images.dto';
import { UserEntity } from 'src/auth/entities/user.entity';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
};

type ProductRef = {
  id: number;
  marca: string;
  modelo: string;
};

type ImportItemResult = {
  file_name: string;
  status: 'uploaded' | 'skipped' | 'failed';
  reason?: string;
  product_id?: number;
  product_key?: string;
  s3_key?: string;
};

type DirectProductFolderImportResult = {
  folder_id: string;
  found: number;
  uploaded: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

@Injectable()
export class DriveImportService {
  private readonly logger = new Logger(DriveImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  async importImagesForProductFromFolder(params: {
    folder_url: string;
    product_type: ProductType;
    product_id: number;
    max_files?: number;
  }): Promise<DirectProductFolderImportResult> {
    const apiKey = this.configService.get<string>('GOOGLE_DRIVE_API_KEY');

    if (!apiKey) {
      throw new BadRequestException(
        'GOOGLE_DRIVE_API_KEY não configurada no ambiente',
      );
    }

    const folderId = this.extractFolderId(params.folder_url);
    const maxFiles = params.max_files ?? 500;

    let files: DriveFile[];
    const warnings: string[] = [];

    try {
      files = await this.listPublicFolderImages(folderId, apiKey, maxFiles);
    } catch (listError: any) {
      return {
        folder_id: folderId,
        found: 0,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        warnings: [
          `Erro ao listar imagens na pasta (${folderId}): ${listError?.message || 'erro desconhecido'}. Verifique se a pasta está compartilhada como "Qualquer pessoa com o link".`,
        ],
      };
    }

    if (files.length === 0) {
      return {
        folder_id: folderId,
        found: 0,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        warnings,
      };
    }

    const existingFileNames = await this.getExistingImageFileNamesByProduct(
      params.product_type,
      params.product_id,
    );
    let hasPrimary = await this.hasPrimaryImage(
      params.product_type,
      params.product_id,
    );

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
      const normalizedName = this.normalizeFileName(file.name);

      if (existingFileNames.has(normalizedName)) {
        skipped += 1;
        warnings.push(`Arquivo duplicado ignorado: ${file.name}`);
        continue;
      }

      try {
        const downloaded = await this.downloadDriveFile(file.id, apiKey);
        const objectKey = this.buildS3ObjectKey(
          params.product_type,
          params.product_id,
          file.name,
        );

        const s3Key = await this.s3Service.uploadBuffer(
          downloaded.buffer,
          objectKey,
          downloaded.contentType,
        );

        const isPrimary = !hasPrimary;
        await this.createImageRecord({
          productType: params.product_type,
          productId: params.product_id,
          imageKey: s3Key,
          isPrimary,
        });

        hasPrimary = hasPrimary || isPrimary;
        existingFileNames.add(normalizedName);
        uploaded += 1;
      } catch (error) {
        failed += 1;
        warnings.push(
          `Falha ao importar ${file.name}: ${error?.message || 'erro desconhecido'}`,
        );
      }

      await this.sleepBetweenDownloads();
    }

    return {
      folder_id: folderId,
      found: files.length,
      uploaded,
      skipped,
      failed,
      warnings,
    };
  }

  async importPublicFolderImages(dto: ImportDriveImagesDto, user: UserEntity) {
    const importStartedAt = new Date();
    const apiKey = this.configService.get<string>('GOOGLE_DRIVE_API_KEY');

    if (!apiKey) {
      throw new BadRequestException(
        'GOOGLE_DRIVE_API_KEY não configurada no ambiente',
      );
    }

    const specialistId = this.resolveSpecialistId(dto, user);
    const folderId = this.extractFolderId(dto.folder_url);
    const dryRun = dto.dry_run ?? false;
    const maxFiles = dto.max_files ?? 500;

    this.logger.log(
      `[drive-import] Iniciando importação. folderId=${folderId}, specialistId=${specialistId}, type=${dto.product_type}, dryRun=${dryRun}`,
    );

    const files = await this.listPublicFolderImages(folderId, apiKey, maxFiles);

    if (files.length === 0) {
      return {
        success: true,
        message: 'Nenhuma imagem encontrada na pasta pública do Google Drive',
        data: {
          folder_id: folderId,
          specialist_id: specialistId,
          product_type: dto.product_type,
          dry_run: dryRun,
          started_at: importStartedAt,
          finished_at: new Date(),
          totals: {
            found: 0,
            uploaded: 0,
            skipped: 0,
            failed: 0,
          },
          items: [] as ImportItemResult[],
        },
      };
    }

    const products = await this.fetchProductsByType(
      dto.product_type,
      specialistId,
    );
    const productIndex = this.buildProductIndex(products);
    const imageNameIndex = await this.buildExistingImageNameIndex(
      dto.product_type,
      products,
    );

    const results: ImportItemResult[] = [];

    for (const file of files) {
      const parsed = this.parseProductFromFileName(file.name);
      if (!parsed) {
        results.push({
          file_name: file.name,
          status: 'skipped',
          reason: 'Nome fora do padrão esperado: marca__modelo__sufixo.ext',
        });
        continue;
      }

      const productKey = `${this.normalizeKey(parsed.marca)}::${this.normalizeKey(parsed.modelo)}`;
      const matched = productIndex.get(productKey) || [];

      if (matched.length === 0) {
        results.push({
          file_name: file.name,
          status: 'skipped',
          reason: `Produto não encontrado para ${parsed.marca} / ${parsed.modelo}`,
          product_key: productKey,
        });
        continue;
      }

      if (matched.length > 1) {
        results.push({
          file_name: file.name,
          status: 'failed',
          reason:
            'Conflito de unicidade: mais de um produto com mesmo marca+modelo para o especialista',
          product_key: productKey,
        });
        continue;
      }

      const product = matched[0];
      const normalizedFileName = this.normalizeFileName(file.name);
      const existingNames = imageNameIndex.get(product.id) ?? new Set<string>();

      if (existingNames.has(normalizedFileName)) {
        results.push({
          file_name: file.name,
          status: 'skipped',
          reason:
            'Imagem duplicada para este produto (nome do arquivo já existente)',
          product_id: product.id,
          product_key: productKey,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          file_name: file.name,
          status: 'uploaded',
          reason: 'dry_run: seria importada',
          product_id: product.id,
          product_key: productKey,
        });
        continue;
      }

      try {
        const downloaded = await this.downloadDriveFile(file.id, apiKey);
        if (!downloaded.contentType.startsWith('image/')) {
          results.push({
            file_name: file.name,
            status: 'skipped',
            reason: `Arquivo ignorado por content-type inválido: ${downloaded.contentType}`,
            product_id: product.id,
            product_key: productKey,
          });
          continue;
        }

        const objectKey = this.buildS3ObjectKey(
          dto.product_type,
          product.id,
          file.name,
        );

        const uploadedKey = await this.s3Service.uploadBuffer(
          downloaded.buffer,
          objectKey,
          downloaded.contentType,
        );

        await this.createImageRecord({
          productType: dto.product_type,
          productId: product.id,
          imageKey: uploadedKey,
          isPrimary: existingNames.size === 0,
        });

        existingNames.add(normalizedFileName);
        imageNameIndex.set(product.id, existingNames);

        results.push({
          file_name: file.name,
          status: 'uploaded',
          product_id: product.id,
          product_key: productKey,
          s3_key: uploadedKey,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Erro desconhecido ao importar';

        results.push({
          file_name: file.name,
          status: 'failed',
          reason: message,
          product_id: product.id,
          product_key: productKey,
        });
      }

      await this.sleepBetweenDownloads();
    }

    const uploaded = results.filter((r) => r.status === 'uploaded').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return {
      success: true,
      message: 'Importação de imagens finalizada',
      data: {
        folder_id: folderId,
        specialist_id: specialistId,
        product_type: dto.product_type,
        dry_run: dryRun,
        started_at: importStartedAt,
        finished_at: new Date(),
        totals: {
          found: files.length,
          uploaded,
          skipped,
          failed,
        },
        items: results,
      },
    };
  }

  private resolveSpecialistId(
    dto: ImportDriveImagesDto,
    user: UserEntity,
  ): string {
    if (user.role === UserRole.ADMIN) {
      if (!dto.specialist_id) {
        throw new BadRequestException(
          'specialist_id é obrigatório para usuário ADMIN',
        );
      }
      return dto.specialist_id;
    }

    if (user.role !== UserRole.SPECIALIST) {
      throw new ForbiddenException(
        'Apenas ADMIN ou SPECIALIST podem importar imagens',
      );
    }

    if (dto.specialist_id && dto.specialist_id !== user.id) {
      throw new ForbiddenException(
        'Especialista só pode importar imagens para si mesmo',
      );
    }

    return user.id;
  }

  private extractFolderId(urlOrId: string): string {
    const trimmed = urlOrId.trim();
    const folderRegex = /\/folders\/([a-zA-Z0-9_-]{10,})/;
    const idRegex = /[?&]id=([a-zA-Z0-9_-]{10,})/;

    const fromFolderPath = trimmed.match(folderRegex)?.[1];
    if (fromFolderPath) return fromFolderPath;

    const fromQuery = trimmed.match(idRegex)?.[1];
    if (fromQuery) return fromQuery;

    if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
      return trimmed;
    }

    throw new BadRequestException('Link/ID da pasta do Google Drive inválido');
  }

  private async listPublicFolderImages(
    folderId: string,
    apiKey: string,
    maxFiles: number,
  ): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    while (files.length < maxFiles) {
      const response = await axios.get<{
        files?: DriveFile[];
        nextPageToken?: string;
      }>('https://www.googleapis.com/drive/v3/files', {
        params: {
          q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
          fields: 'nextPageToken,files(id,name,mimeType,size)',
          pageSize: Math.min(1000, maxFiles - files.length),
          pageToken,
          key: apiKey,
        },
        timeout: 30000,
      });

      const batch = response.data.files ?? [];
      files.push(...batch);

      pageToken = response.data.nextPageToken;
      if (!pageToken) {
        break;
      }
    }

    return files.slice(0, maxFiles);
  }

  private async fetchProductsByType(
    type: ProductType,
    specialistId: string,
  ): Promise<ProductRef[]> {
    switch (type) {
      case ProductType.CAR:
        return this.prisma.car.findMany({
          where: { specialist_id: specialistId },
          select: { id: true, marca: true, modelo: true },
        });
      case ProductType.BOAT:
        return this.prisma.boat.findMany({
          where: { specialist_id: specialistId },
          select: { id: true, marca: true, modelo: true },
        });
      case ProductType.AIRCRAFT:
        return this.prisma.aircraft.findMany({
          where: { specialist_id: specialistId },
          select: { id: true, marca: true, modelo: true },
        });
      default:
        throw new BadRequestException(`Tipo de produto não suportado: ${type}`);
    }
  }

  private buildProductIndex(products: ProductRef[]): Map<string, ProductRef[]> {
    const index = new Map<string, ProductRef[]>();

    for (const product of products) {
      const key = `${this.normalizeKey(product.marca)}::${this.normalizeKey(product.modelo)}`;
      const existing = index.get(key) ?? [];
      existing.push(product);
      index.set(key, existing);
    }

    return index;
  }

  private async buildExistingImageNameIndex(
    type: ProductType,
    products: ProductRef[],
  ): Promise<Map<number, Set<string>>> {
    const index = new Map<number, Set<string>>();
    const ids = products.map((p) => p.id);

    if (ids.length === 0) {
      return index;
    }

    if (type === ProductType.CAR) {
      const records = await this.prisma.car_image.findMany({
        where: { car_id: { in: ids } },
        select: { car_id: true, image_url: true },
      });

      for (const record of records) {
        if (!record.car_id) continue;
        const set = index.get(record.car_id) ?? new Set<string>();
        set.add(this.normalizeFileName(this.extractFileName(record.image_url)));
        index.set(record.car_id, set);
      }
      return index;
    }

    if (type === ProductType.BOAT) {
      const records = await this.prisma.boat_image.findMany({
        where: { boat_id: { in: ids } },
        select: { boat_id: true, image_url: true },
      });

      for (const record of records) {
        if (!record.boat_id) continue;
        const set = index.get(record.boat_id) ?? new Set<string>();
        set.add(this.normalizeFileName(this.extractFileName(record.image_url)));
        index.set(record.boat_id, set);
      }
      return index;
    }

    const records = await this.prisma.aircraft_image.findMany({
      where: { aircraft_id: { in: ids } },
      select: { aircraft_id: true, image_url: true },
    });

    for (const record of records) {
      if (!record.aircraft_id) continue;
      const set = index.get(record.aircraft_id) ?? new Set<string>();
      set.add(this.normalizeFileName(this.extractFileName(record.image_url)));
      index.set(record.aircraft_id, set);
    }

    return index;
  }

  private async getExistingImageFileNamesByProduct(
    type: ProductType,
    productId: number,
  ): Promise<Set<string>> {
    const names = new Set<string>();

    if (type === ProductType.CAR) {
      const records = await this.prisma.car_image.findMany({
        where: { car_id: productId },
        select: { image_url: true },
      });

      for (const record of records) {
        names.add(
          this.normalizeFileName(this.extractFileName(record.image_url)),
        );
      }

      return names;
    }

    if (type === ProductType.BOAT) {
      const records = await this.prisma.boat_image.findMany({
        where: { boat_id: productId },
        select: { image_url: true },
      });

      for (const record of records) {
        names.add(
          this.normalizeFileName(this.extractFileName(record.image_url)),
        );
      }

      return names;
    }

    const records = await this.prisma.aircraft_image.findMany({
      where: { aircraft_id: productId },
      select: { image_url: true },
    });

    for (const record of records) {
      names.add(this.normalizeFileName(this.extractFileName(record.image_url)));
    }

    return names;
  }

  private async hasPrimaryImage(
    type: ProductType,
    productId: number,
  ): Promise<boolean> {
    if (type === ProductType.CAR) {
      const record = await this.prisma.car_image.findFirst({
        where: { car_id: productId, is_primary: true },
        select: { id: true },
      });
      return Boolean(record);
    }

    if (type === ProductType.BOAT) {
      const record = await this.prisma.boat_image.findFirst({
        where: { boat_id: productId, is_primary: true },
        select: { id: true },
      });
      return Boolean(record);
    }

    const record = await this.prisma.aircraft_image.findFirst({
      where: { aircraft_id: productId, is_primary: true },
      select: { id: true },
    });
    return Boolean(record);
  }

  private parseProductFromFileName(fileName: string): {
    marca: string;
    modelo: string;
  } | null {
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const parts = baseName
      .split('__')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    return {
      marca: parts[0],
      modelo: parts[1],
    };
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private sanitizeS3FileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  private extractFileName(pathOrUrl: string): string {
    const cleaned = pathOrUrl.split('?')[0];
    const segments = cleaned.split('/');
    return decodeURIComponent(segments[segments.length - 1] || cleaned);
  }

  private buildS3ObjectKey(
    type: ProductType,
    productId: number,
    originalName: string,
  ): string {
    const safeFileName = this.sanitizeS3FileName(originalName);
    return `drive-import/${type.toLowerCase()}/${productId}/${safeFileName}`;
  }

  private async downloadDriveFile(
    fileId: string,
    _apiKey: string,
  ): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    // Usa URL pública do Drive — não consome quota de API key
    // A API key só é usada para listagem; downloads vão pela URL pública
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [500, 1500, 4000]; // ms — backoff exponencial

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS[attempt - 1]),
        );
      }

      try {
        const response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          maxContentLength: 15 * 1024 * 1024,
          maxBodyLength: 15 * 1024 * 1024,
          headers: { 'User-Agent': 'high-class-shop-drive-importer/1.0' },
        });

        const contentType =
          typeof response.headers['content-type'] === 'string'
            ? response.headers['content-type'].split(';')[0].trim()
            : 'application/octet-stream';

        return {
          buffer: Buffer.from(response.data),
          contentType,
        };
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;

        // Erros que valem retry: rate limit (429), server error (5xx), bad gateway (502)
        const isRetryable =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        // 403 = arquivo não público; 404 = não existe — não adianta retry
        if (!isRetryable && status !== undefined) {
          const errorBody = error?.response?.data
            ? Buffer.from(error.response.data).toString('utf-8').slice(0, 300)
            : '';
          throw new Error(
            `Google Drive retornou ${status} para arquivo ${fileId}. ` +
              (errorBody || 'Verifique se a pasta está compartilhada como "Qualquer pessoa com o link".'),
          );
        }

        this.logger.warn(
          `[downloadDriveFile] Tentativa ${attempt + 1}/${MAX_RETRIES} falhou para ${fileId}: status=${status ?? 'network error'}`,
        );
      }
    }

    throw lastError ?? new Error(`Falha ao baixar arquivo ${fileId} do Google Drive após ${MAX_RETRIES} tentativas`);
  }

  private async sleepBetweenDownloads(): Promise<void> {
    // 250ms entre downloads — mantém bem abaixo de 100 req/100s da API key
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  private async createImageRecord(params: {
    productType: ProductType;
    productId: number;
    imageKey: string;
    isPrimary: boolean;
  }): Promise<void> {
    const { productType, productId, imageKey, isPrimary } = params;

    if (productType === ProductType.CAR) {
      await this.prisma.car_image.create({
        data: {
          car_id: productId,
          image_url: imageKey,
          is_primary: isPrimary,
          product_type: 'CAR',
        },
      });
      return;
    }

    if (productType === ProductType.BOAT) {
      await this.prisma.boat_image.create({
        data: {
          boat_id: productId,
          image_url: imageKey,
          is_primary: isPrimary,
          product_type: 'BOAT',
        },
      });
      return;
    }

    await this.prisma.aircraft_image.create({
      data: {
        aircraft_id: productId,
        image_url: imageKey,
        is_primary: isPrimary,
        product_type: 'AIRCRAFT',
      },
    });
  }
}
