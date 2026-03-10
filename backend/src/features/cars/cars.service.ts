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
  CsvImportService,
  CsvColumnDefinition,
} from 'src/shared/services/csv-import.service';
import {
  CsvImportResponseDto,
  CsvErrorRow,
} from 'src/shared/dto/csv-import-response.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);

  // Definição das colunas do CSV para carros
  private readonly csvColumns: CsvColumnDefinition[] = [
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
    { name: 'imagens', required: false, type: 'string' }, // URLs ou base64 separadas por | (pipe)
  ];

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
    private csvImportService: CsvImportService,
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
      await this.prismaService.car.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar carro: ${error.message}`);
    }
  }

  /**
   * Retorna o template CSV para importação de carros
   */
  getCsvTemplate() {
    const requiredColumns = this.csvColumns
      .filter((c) => c.required)
      .map((c) => c.name);
    const optionalColumns = this.csvColumns
      .filter((c) => !c.required)
      .map((c) => c.name);

    const templateHeader = this.csvColumns.map((c) => c.name).join(',');
    const exampleRow =
      'BMW,X5,450000,São Paulo,2023,Preto,15000,Automático,Gasolina,SUV,Carro em excelente estado,https://example.com/img1.jpg|https://example.com/img2.jpg';

    return {
      template: `${templateHeader}\n${exampleRow}`,
      columns: {
        required: requiredColumns,
        optional: optionalColumns,
      },
      instructions: {
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
        imagens:
          'URLs de imagens separadas por | (pipe). Primeira imagem será a principal. Ex: https://img1.jpg|https://img2.jpg (opcional)',
      },
      example: {
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
        imagens: 'https://example.com/img1.jpg|https://example.com/img2.jpg',
      },
    };
  }

  /**
   * Importa carros a partir de um CSV
   */
  async importFromCsv(
    csvContent: string,
    user: UserEntity,
  ): Promise<CsvImportResponseDto> {
    // 1. Validar estrutura do CSV
    const structureValidation = this.csvImportService.validateStructure(
      csvContent,
      this.csvColumns,
    );

    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura do CSV inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    // 2. Parsear o CSV
    const rows = this.csvImportService.parseCSV(csvContent);

    const insertedIds: number[] = [];
    const updatedIds: number[] = [];
    const errorRows: CsvErrorRow[] = [];
    const warningRows: CsvErrorRow[] = [];

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

        // Processar imagens (suporte a múltiplas URLs separadas por |)
        const imageUrls = this.csvImportService.parseDelimitedImages(
          row.imagens || row.imagem, // retrocompatível com coluna 'imagem'
        );

        if (imageUrls.length > 0) {
          // Se é atualização, remover imagens antigas antes de adicionar novas
          if (isUpdate) {
            await this.prismaService.car_image.deleteMany({
              where: { car_id: car.id },
            });
          }

          const imageErrors: string[] = [];
          let successCount = 0;

          for (let imgIdx = 0; imgIdx < imageUrls.length; imgIdx++) {
            try {
              const timestamp = Date.now();
              const key = `cars/${car.id}/${timestamp}-${imgIdx}.jpg`;
              const imageKey = await this.s3Service.uploadImageAuto(
                imageUrls[imgIdx],
                key,
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
              reason: `Produto ${isUpdate ? 'atualizado' : 'criado'} (${successCount}/${imageUrls.length} imagens processadas)`,
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

    return this.csvImportService.createResponse(
      insertedIds,
      errorRows,
      warningRows,
      updatedIds,
    );
  }
}
