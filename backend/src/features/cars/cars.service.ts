import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsCarFilters,
  ExactCarFilters,
  FiltersCarMeta,
  RangeCarFilters,
} from 'src/shared/dto/filters.dto';
import { Car } from './entity/car.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import {
  XlsxImportService,
  XlsxColumnDefinition,
} from 'src/shared/services/xlsx-import.service';
import {
  ImportResponseDto,
  ImportErrorRow,
} from 'src/shared/dto/import-response.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);

  // Definição das colunas da planilha para carros (sem 'imagens' — agora são embutidas)
  private readonly xlsxColumns: XlsxColumnDefinition[] = [
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

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
    private xlsxImportService: XlsxImportService,
  ) {}

  async create(createCarDto: CreateCarDto) {
    const { images, ...carData } = createCarDto;

    try {
      // 1. Criar o carro
      const car = await this.prismaService.car.create({ data: carData });

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          // Gerar chave única para a imagem no S3
          const timestamp = Date.now();
          const key = `cars/${car.id}/${timestamp}-${i}.jpg`;

          // Upload da imagem base64 para o S3
          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

          // Salvar referência da imagem no banco de dados
          await this.prismaService.car_image.create({
            data: {
              car_id: car.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'CAR',
            },
          });
        }
      }

      // 3. Retornar o carro com as imagens
      return await this.prismaService.car.findUnique({
        where: { id: car.id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao criar carro: ${error.message}`);
    }
  }

  async getAllCars({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersCarMeta>) {
    // Cálculo das variáveis usadas na requisição ao banco de dados
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Separação dos filtros
    const where: any = {};
    where.is_active = true;

    // Exact
    const exacts: ExactCarFilters = {
      cambio: appliedFilters?.cambio,
      combustivel: appliedFilters?.combustivel,
      estado: appliedFilters?.estado,
      tipo_categoria: appliedFilters?.tipo_categoria,
    };
    // Insere a filtragem exata na variavel where
    for (const [key, value] of Object.entries(exacts)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    // Contains
    const contains: ContainsCarFilters = {
      cor: appliedFilters?.cor,
      marca: appliedFilters?.marca,
      modelo: appliedFilters?.modelo,
    };
    // Insere a filtragem que usam contains na variável where
    for (const [key, value] of Object.entries(contains)) {
      if (value !== undefined && value !== null) {
        where[key] = { contains: value, mode: 'insensitive' };
      }
    }

    // Range
    const rangeFilters: RangeCarFilters = {
      ano_max: appliedFilters?.ano_max,
      ano_min: appliedFilters?.ano_min,
      km_max: appliedFilters?.km_max,
      preco_max: appliedFilters?.preco_max,
      preco_min: appliedFilters?.preco_min,
    };
    // Cria um objeto para orientar um where que usa gte e lte
    const rangeMap = {
      preco: { gte: rangeFilters.preco_min, lte: rangeFilters.preco_max },
      ano: { gte: rangeFilters.ano_min, lte: rangeFilters.ano_max },
      km: { gte: undefined, lte: rangeFilters.km_max },
    };
    // Insere a filtragem que são um intervalo na variável where
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      const hasGte = gte !== undefined && gte !== null;
      const hasLte = lte !== undefined && lte !== null;
      // Crie o objeto caso tenha lte ou gte
      if (hasGte || hasLte) {
        where[key] = {};
        if (hasGte) where[key].gte = gte;
        if (hasLte) where[key].lte = lte;
      }
    }

    // Filtro por especialista (usado na tela "Meus Produtos")
    if (appliedFilters?.specialist_id) {
      where.specialist_id = appliedFilters.specialist_id;
    }

    // Agrupamento de operações para serem realizadas no banco de dados
    const [cars, total] = await this.prismaService.$transaction([
      this.prismaService.car.findMany({
        skip: skip,
        take: take,
        where: where,
        include: {
          images: true,
          specialist: true,
        },
      }),
      this.prismaService.car.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada carro
    const carEntities: Car[] = await Promise.all(
      cars.map(async (car) => {
        let imagesWithUrls: any[] = [];
        if (car.images && car.images.length > 0) {
          imagesWithUrls = await Promise.all(
            car.images.map(async (image) => ({
              ...image,
              image_url: await this.s3Service.getSignedUrl(image.image_url),
            })),
          );
        }

        return {
          ...car,
          valor: car.valor.toNumber(),
          images: imagesWithUrls,
          specialist: car.specialist
            ? UserEntity.fromPrisma(car.specialist)
            : null,
        };
      }),
    );

    return {
      data: carEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    this.logger.log(`[findOne] Buscando carro - ID: ${id}`);
    const car = await this.prismaService.car.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!car) {
      this.logger.warn(`[findOne] Carro não encontrado - ID: ${id}`);
      throw new NotFoundException('Car not found');
    }
    this.logger.log(`[findOne] Carro encontrado - ID: ${id}`);

    // Converter as keys do S3 em URLs assinadas
    if (car.images && car.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        car.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        })),
      );
      return { ...car, images: imagesWithUrls };
    }

    return { ...car };
  }

  async update(id: number, updateCarDto: UpdateCarDto) {
    await this.findOne(id);

    const { images, ...carData } = updateCarDto;

    try {
      // 1. Atualizar dados do carro
      await this.prismaService.car.update({ where: { id }, data: carData });

      // 2. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await this.prismaService.car_image.deleteMany({
          where: { car_id: id },
        });

        // Adicionar novas imagens
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `cars/${id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

          await this.prismaService.car_image.create({
            data: {
              car_id: id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'CAR',
            },
          });
        }
      }

      // 3. Retornar o carro atualizado com imagens
      return await this.prismaService.car.findUnique({
        where: { id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao atualizar carro: ${error.message}`);
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prismaService.car.update({
        where: { id },
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: null,
        },
      });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar carro: ${error.message}`);
    }
  }

  /**
   * Retorna o template XLSX para importação de carros
   */
  async getXlsxTemplate(): Promise<Buffer> {
    const instructions: Record<string, string> = {
      marca: 'Nome da marca do carro (texto)',
      modelo: 'Nome do modelo (texto)',
      valor: 'Preço em reais (número inteiro, sem pontos ou vírgulas)',
      estado: 'Estado onde o carro está localizado (texto)',
      ano: 'Ano de fabricação (número)',
      cor: 'Cor do veículo (texto, opcional)',
      km: 'Quilometragem (número, opcional)',
      cambio: 'Tipo de câmbio: Manual, Automático, CVT (opcional)',
      combustivel:
        'Tipo de combustível: Gasolina, Etanol, Flex, Diesel, Elétrico, Híbrido (opcional)',
      tipo_categoria: 'Categoria: Sedan, SUV, Hatch, Pickup, etc (opcional)',
      descricao: 'Descrição detalhada do veículo (texto, opcional)',
      folder_url:
        'Link da pasta pública do Google Drive com imagens deste produto (opcional)',
    };

    const example: Record<string, any> = {
      marca: 'BMW',
      modelo: 'X5',
      valor: 450000,
      estado: 'São Paulo',
      ano: 2023,
      cor: 'Preto',
      km: 15000,
      cambio: 'Automático',
      combustivel: 'Gasolina',
      tipo_categoria: 'SUV',
      descricao: 'Carro em excelente estado',
      folder_url: 'https://drive.google.com/drive/folders/SEU_FOLDER_ID',
    };

    return this.xlsxImportService.generateTemplate(
      this.xlsxColumns,
      example,
      instructions,
    );
  }

  async getCsvTemplate(): Promise<Buffer> {
    const headers = this.xlsxColumns.map((column) => column.name).join(';');
    const exampleValues = [
      'BMW',
      'X5',
      '450000',
      'São Paulo',
      '2023',
      'Preto',
      '15000',
      'Automático',
      'Gasolina',
      'SUV',
      'Carro em excelente estado',
      'https://drive.google.com/drive/folders/SEU_FOLDER_ID',
    ].join(';');

    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from(`${headers}\n${exampleValues}\n`, 'utf-8');
    return Buffer.concat([BOM, content]);
  }

  /**
   * Importa carros a partir de um arquivo CSV
   */
  async importFromCsv(
    fileBuffer: Buffer,
    user: UserEntity,
  ): Promise<ImportResponseDto> {
    const { rows } = this.xlsxImportService.parseCsv(fileBuffer);

    const structureValidation = this.xlsxImportService.validateStructure(
      rows,
      this.xlsxColumns,
    );

    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura do CSV inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    const insertedIds: number[] = [];
    const updatedIds: number[] = [];
    const errorRows: ImportErrorRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i];

      try {
        const carData: any = {
          marca: row.marca,
          modelo: row.modelo,
          valor: Number(row.valor),
          estado: row.estado,
          ano: Number(row.ano),
          specialist_id: user.id,
        };

        if (row.cor) carData.cor = row.cor;
        if (row.km) carData.km = Number(row.km);
        if (row.cambio) carData.cambio = row.cambio;
        if (row.combustivel) carData.combustivel = row.combustivel;
        if (row.tipo_categoria) carData.tipo_categoria = row.tipo_categoria;
        if (row.descricao) carData.descricao = row.descricao;

        const dto = plainToInstance(CreateCarDto, carData);
        const validationErrors = await validate(dto, { whitelist: true });

        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map((err) => {
            const constraints = err.constraints
              ? Object.values(err.constraints)
              : [];
            return `${err.property}: ${constraints.join(', ')}`;
          });

          errorRows.push({
            row: rowNumber,
            reason: errorMessages.join('; '),
            fields: row,
          });
          continue;
        }

        const existingCar = await this.prismaService.car.findFirst({
          where: {
            marca: row.marca?.trim(),
            modelo: row.modelo?.trim(),
            specialist_id: user.id,
          },
        });

        if (existingCar) {
          const { specialist_id, ...updateFields } = carData;
          await this.prismaService.car.update({
            where: { id: existingCar.id },
            data: updateFields,
          });
          updatedIds.push(existingCar.id);
        } else {
          const createdCar = await this.prismaService.car.create({
            data: carData,
          });
          insertedIds.push(createdCar.id);
        }
      } catch (error) {
        errorRows.push({
          row: rowNumber,
          reason: error.message || 'Erro desconhecido ao processar linha',
          fields: row,
        });
      }
    }

    return this.xlsxImportService.createResponse(
      insertedIds,
      errorRows,
      [],
      updatedIds,
    );
  }

  /**
   * Importa carros a partir de um arquivo XLSX
   */
  async importFromXlsx(
    fileBuffer: Buffer,
    user: UserEntity,
  ): Promise<ImportResponseDto> {
    // 1. Parsear a planilha XLSX (dados + imagens embutidas)
    const { rows, imageMap } =
      await this.xlsxImportService.parseWorkbook(fileBuffer);

    // 2. Validar estrutura
    const structureValidation = this.xlsxImportService.validateStructure(
      rows,
      this.xlsxColumns,
    );

    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura da planilha inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    const insertedIds: number[] = [];
    const updatedIds: number[] = [];
    const errorRows: ImportErrorRow[] = [];
    const warningRows: ImportErrorRow[] = [];

    // 3. Processar cada linha
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 porque linha 1 é header e arrays começam em 0
      const row = rows[i];

      try {
        // Preparar DTO
        const carData: any = {
          marca: row.marca,
          modelo: row.modelo,
          valor: Number(row.valor),
          estado: row.estado,
          ano: Number(row.ano),
          specialist_id: user.id,
        };

        // Campos opcionais
        if (row.cor) carData.cor = row.cor;
        if (row.km) carData.km = Number(row.km);
        if (row.cambio) carData.cambio = row.cambio;
        if (row.combustivel) carData.combustivel = row.combustivel;
        if (row.tipo_categoria) carData.tipo_categoria = row.tipo_categoria;
        if (row.descricao) carData.descricao = row.descricao;

        // Validar usando class-validator
        const dto = plainToInstance(CreateCarDto, carData);
        const validationErrors = await validate(dto, { whitelist: true });

        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map((err) => {
            const constraints = err.constraints
              ? Object.values(err.constraints)
              : [];
            return `${err.property}: ${constraints.join(', ')}`;
          });

          errorRows.push({
            row: rowNumber,
            reason: errorMessages.join('; '),
            fields: row,
          });
          continue;
        }

        // Verificar se já existe um produto com mesma marca + modelo para este especialista
        const existingCar = await this.prismaService.car.findFirst({
          where: {
            marca: row.marca?.trim(),
            modelo: row.modelo?.trim(),
            specialist_id: user.id,
          },
        });

        let car: any;
        let isUpdate = false;

        if (existingCar) {
          // Atualizar produto existente
          const { specialist_id, ...updateFields } = carData;
          car = await this.prismaService.car.update({
            where: { id: existingCar.id },
            data: updateFields,
          });
          isUpdate = true;
        } else {
          // Criar novo produto
          car = await this.prismaService.car.create({ data: carData });
        }

        // Processar imagens embutidas da planilha
        const embeddedImages = imageMap.get(i) || [];

        if (embeddedImages.length > 0) {
          // Se é atualização, remover imagens antigas antes de adicionar novas
          if (isUpdate) {
            await this.prismaService.car_image.deleteMany({
              where: { car_id: car.id },
            });
          }

          const imageErrors: string[] = [];
          let successCount = 0;

          for (let imgIdx = 0; imgIdx < embeddedImages.length; imgIdx++) {
            try {
              const img = embeddedImages[imgIdx];
              const timestamp = Date.now();
              const key = `cars/${car.id}/${timestamp}-${imgIdx}.${img.extension}`;
              const contentType = `image/${img.extension === 'jpg' ? 'jpeg' : img.extension}`;
              const imageKey = await this.s3Service.uploadBuffer(
                img.buffer,
                key,
                contentType,
              );

              await this.prismaService.car_image.create({
                data: {
                  car_id: car.id,
                  image_url: imageKey,
                  is_primary: imgIdx === 0,
                  product_type: 'CAR',
                },
              });
              successCount++;
            } catch (imageError) {
              imageErrors.push(
                `Imagem ${imgIdx + 1}: ${imageError.message || 'Erro desconhecido'}`,
              );
            }
          }

          if (imageErrors.length > 0) {
            warningRows.push({
              row: rowNumber,
              reason: `Produto ${isUpdate ? 'atualizado' : 'criado'} (${successCount}/${embeddedImages.length} imagens processadas)`,
              fields: row,
              imageWarnings: imageErrors,
            });
          }
        }

        if (isUpdate) {
          updatedIds.push(car.id);
        } else {
          insertedIds.push(car.id);
        }
      } catch (error) {
        errorRows.push({
          row: rowNumber,
          reason: error.message || 'Erro desconhecido ao processar linha',
          fields: row,
        });
      }
    }

    return this.xlsxImportService.createResponse(
      insertedIds,
      errorRows,
      warningRows,
      updatedIds,
    );
  }
}
