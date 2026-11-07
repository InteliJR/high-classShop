import {
  HttpException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
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
import { updateProductWithMonetaryLock } from '../products/product-monetary-lock';
import { publicCarSelect } from 'src/shared/selects/public-catalog.select';
import { randomUUID } from 'node:crypto';
import {
  cleanupPreparedProductImages,
  prepareProductImages,
  PreparedProductImage,
  ProductImageInput,
} from '../products/product-image-preparation';

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);


  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  prepareProductImages(productId: string, images?: ProductImageInput[]) {
    return prepareProductImages(this.s3Service, 'cars', productId, images);
  }

  cleanupPreparedImages(images: PreparedProductImage[]) {
    return cleanupPreparedProductImages(this.s3Service, images);
  }

  async create(
    createCarDto: CreateCarDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: {
      productId: string;
      images: PreparedProductImage[];
    },
  ) {
    const { images, ...carData } = createCarDto;
    const productId = preparedWrite?.productId ?? randomUUID();
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ??
      (await this.prepareProductImages(productId, images));

    try {
      // 1. Criar o carro
      const car = await client.car.create({
        data: { ...carData, id: productId },
      });

      // 2. Persistir somente referências já preparadas fora da transação
      if (preparedImages.length > 0) {
        for (const image of preparedImages) {
          await client.car_image.create({
            data: {
              car_id: car.id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'CAR',
            },
          });
        }
      }

      // 3. Retornar o carro com as imagens
      return await client.car.findUnique({
        where: { id: car.id },
        include: { images: true },
      });
    } catch (error) {
      if (ownsPreparedImages) {
        await this.cleanupPreparedImages(preparedImages);
      }
      if (
        error instanceof HttpException ||
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        throw error;
      }
      throw new Error(`Erro ao criar carro: ${error.message}`);
    }
  }

  async getAllCars({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersCarMeta>, includeInactive = false) {
    // Cálculo das variáveis usadas na requisição ao banco de dados
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Separação dos filtros
    const where: any = {};
    if (!includeInactive) where.is_active = true;

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
        select: publicCarSelect,
      }),
      this.prismaService.car.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada carro
    const carEntities = await Promise.all(
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
          specialist: car.specialist,
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
      select: publicCarSelect,
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
      return {
        ...car,
        valor: car.valor.toNumber(),
        images: imagesWithUrls,
      };
    }

    return { ...car, valor: car.valor.toNumber() };
  }

  async update(
    id: string,
    updateCarDto: UpdateCarDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: { images: PreparedProductImage[] },
  ) {
    const { images, ...carData } = updateCarDto;
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ?? (await this.prepareProductImages(id, images));

    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.CAR,
        productId: id,
        nextValue: updateCarDto.valor,
        nextCurrency: updateCarDto.currency,
        data: carData,
        notFoundMessage: 'Car not found',
      });

      // 1. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await client.car_image.deleteMany({
          where: { car_id: id },
        });

        // Adicionar referências das imagens já preparadas
        for (const image of preparedImages) {
          await client.car_image.create({
            data: {
              car_id: id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'CAR',
            },
          });
        }
      }

      // 2. Retornar o carro atualizado com imagens
      return await client.car.findUnique({
        where: { id },
        include: { images: true },
      });
    } catch (error) {
      if (ownsPreparedImages) {
        await this.cleanupPreparedImages(preparedImages);
      }
      if (
        error instanceof HttpException ||
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        throw error;
      }
      throw new Error(`Erro ao atualizar carro: ${error.message}`);
    }
  }

  async remove(
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ) {
    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.CAR,
        productId: id,
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: null,
        },
        notFoundMessage: 'Carro não encontrado',
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new Error(`Erro ao deletar carro: ${error.message}`);
    }
  }

}
