import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { CAR_COLUMNS } from 'src/shared/constants/product-columns';

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);

  // Colunas da planilha de carros — fonte única em shared/constants/product-columns.ts
  private readonly xlsxColumns = CAR_COLUMNS;

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw error;
      }
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

  async findOne(id: string) {
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

  async update(id: string, updateCarDto: UpdateCarDto) {
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw error;
      }
      throw new Error(`Erro ao atualizar carro: ${error.message}`);
    }
  }

  async remove(id: string) {
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

  async getCsvTemplate(): Promise<Buffer> {
    const headers = this.xlsxColumns.map((column) => column.name).join(';');
    const exampleValues = [
      'BMW-X5-1',
      'BMW',
      'X5',
      '450000',
      'BRL',
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
}
