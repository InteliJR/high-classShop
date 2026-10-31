import {
  HttpException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsAircraftFilters,
  ExactAircraftFilters,
  FiltersAircraftMeta,
  RangeAircraftFilters,
} from 'src/shared/dto/filters.dto';
import { Prisma, ProductType } from '@prisma/client';
import { updateProductWithMonetaryLock } from '../products/product-monetary-lock';
import { publicAircraftSelect } from 'src/shared/selects/public-catalog.select';
import { randomUUID } from 'node:crypto';
import {
  cleanupPreparedProductImages,
  prepareProductImages,
  PreparedProductImage,
  ProductImageInput,
} from '../products/product-image-preparation';

@Injectable()
export class AircraftsService {
  private readonly logger = new Logger(AircraftsService.name);


  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  prepareProductImages(productId: string, images?: ProductImageInput[]) {
    return prepareProductImages(
      this.s3Service,
      'aircrafts',
      productId,
      images,
    );
  }

  cleanupPreparedImages(images: PreparedProductImage[]) {
    return cleanupPreparedProductImages(this.s3Service, images);
  }

  async create(
    createAircraftDto: CreateAircraftDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: {
      productId: string;
      images: PreparedProductImage[];
    },
  ) {
    this.logger.log('[create] Iniciando criação de nova aeronave');
    const { specialist_id, images, ...aircraftData } = createAircraftDto;
    const productId = preparedWrite?.productId ?? randomUUID();
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ??
      (await this.prepareProductImages(productId, images));

    const payload: Prisma.AircraftUncheckedCreateInput = {
      categoria: aircraftData.categoria,
      ano: aircraftData.ano,
      marca: aircraftData.marca,
      modelo: aircraftData.modelo,
      identificador: aircraftData.identificador,
      assentos: aircraftData.assentos,
      estado: aircraftData.estado,
      descricao: aircraftData.descricao,
      valor: aircraftData.valor,
      currency: aircraftData.currency,
      tipo_aeronave: aircraftData.tipo_aeronave,
      specialist_id: specialist_id ?? null,
      id: productId,
    };

    try {
      // 1. Criar a aeronave
      this.logger.debug(
        `[create] Criando aeronave: ${aircraftData.marca} ${aircraftData.modelo}`,
      );
      const aircraft = await client.aircraft.create({
        data: payload,
      });
      this.logger.log(
        `[create] Aeronave criada com sucesso - ID: ${aircraft.id}`,
      );

      // 2. Persistir somente referências já preparadas fora da transação
      if (preparedImages.length > 0) {
        this.logger.log(
          `[create] Persistindo ${preparedImages.length} imagens para a aeronave ${aircraft.id}`,
        );
        for (const image of preparedImages) {
          await client.aircraft_image.create({
            data: {
              aircraft_id: aircraft.id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
        this.logger.log(
          `[create] Todas as ${preparedImages.length} imagens persistidas com sucesso`,
        );
      }

      // 3. Retornar a aeronave com as imagens
      const aircraftWithImages = await client.aircraft.findUnique({
        where: { id: aircraft.id },
        include: { images: true },
      });
      if (!aircraftWithImages) {
        throw new Error('Erro ao buscar aeronave criada');
      }
      this.logger.log(
        `[create] Aeronave ${aircraft.id} criada com sucesso com ${aircraftWithImages.images.length} imagens`,
      );
      return aircraftWithImages;
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
      this.logger.error(
        `[create] Erro ao criar aeronave: ${error.message}`,
        error.stack,
      );
      throw new Error(`Erro ao criar aeronave: ${error.message}`);
    }
  }

  // async create(data: CreateAircraftDto) {

  //   return this.prismaService.aircraft.create( {data});
  // }

  async getAllAircrafts({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersAircraftMeta>, includeInactive = false) {
    // Cálculo das variáveis que serão utilizadas
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Separação dos filtros
    const where: any = {};
    if (!includeInactive) where.is_active = true;

    // Exact
    const exacts: ExactAircraftFilters = {
      estado: appliedFilters?.estado,
      tipo_aeronave: appliedFilters?.tipo_aeronave,
    };
    // Insere a filtragem na variável where
    for (const [key, value] of Object.entries(exacts)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    // Contains
    const contains: ContainsAircraftFilters = {
      categoria: appliedFilters?.categoria,
      marca: appliedFilters?.marca,
      modelo: appliedFilters?.modelo,
    };
    // Insere a filtragem a variável where
    for (const [key, value] of Object.entries(contains)) {
      if (value !== undefined && value !== null) {
        where[key] = { contains: value, mode: 'insensitive' };
      }
    }

    // Range
    const rangeFilters: RangeAircraftFilters = {
      ...appliedFilters,
    };
    // Objeto para orientar o where wu utiliza gte e lte
    const rangeMap = {
      ano: { gte: rangeFilters?.ano_max, lte: rangeFilters?.ano_min },
      preco: { gte: rangeFilters?.preco_max, lte: rangeFilters?.preco_min },
      assento: {
        gte: rangeFilters?.assentos_max,
        lte: rangeFilters?.assentos_min,
      },
    };
    // Insere a filtragem como um intervalo na variável where
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      const hasGte = gte !== undefined && gte !== null;
      const hasLte = lte !== undefined && lte !== null;
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

    //Agrupamento das operações que serão realizadas no banco de dados
    const [aircrafts, total] = await this.prismaService.$transaction([
      this.prismaService.aircraft.findMany({
        skip: skip,
        take: take,
        where: where,
        select: publicAircraftSelect,
      }),
      this.prismaService.aircraft.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada aeronave
    const aircraftsEntities = await Promise.all(
      aircrafts.map(async (aircraft) => {
        let imagesWithUrls: any[] = [];
        if (aircraft.images && aircraft.images.length > 0) {
          imagesWithUrls = await Promise.all(
            aircraft.images.map(async (image) => ({
              ...image,
              image_url: await this.s3Service.getSignedUrl(image.image_url),
            })),
          );
        }

        return {
          ...aircraft,
          valor: aircraft.valor.toNumber(),
          images: imagesWithUrls,
          specialist: aircraft.specialist,
        };
      }),
    );

    return {
      data: aircraftsEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: string) {
    this.logger.log(`[findOne] Buscando aeronave - ID: ${id}`);
    const aircraft = await this.prismaService.aircraft.findUnique({
      where: { id },
      select: publicAircraftSelect,
    });
    if (!aircraft) {
      this.logger.warn(`[findOne] Aeronave não encontrada - ID: ${id}`);
      throw new NotFoundException('Aircraft not found');
    }
    this.logger.log(`[findOne] Aeronave encontrada - ID: ${id}`);

    // Converter as keys do S3 em URLs assinadas
    if (aircraft.images && aircraft.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        aircraft.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        })),
      );
      return {
        ...aircraft,
        valor: aircraft.valor.toNumber(),
        images: imagesWithUrls,
      };
    }

    return { ...aircraft, valor: aircraft.valor.toNumber() };
  }

  // update(id: string, updateAircraftDto: UpdateAircraftDto) {
  //   return `This action updates a #${id} aircraft`;
  // }

  async update(
    id: string,
    updateAircraftDto: UpdateAircraftDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: { images: PreparedProductImage[] },
  ) {
    const { specialist_id, images, ...aircraftData } = updateAircraftDto;
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ?? (await this.prepareProductImages(id, images));
    const payload: Prisma.AircraftUncheckedUpdateInput = {};

    if (aircraftData.categoria !== undefined) {
      payload.categoria = aircraftData.categoria;
    }
    if (aircraftData.ano !== undefined) {
      payload.ano = aircraftData.ano;
    }
    if (aircraftData.marca !== undefined) {
      payload.marca = aircraftData.marca;
    }
    if (aircraftData.modelo !== undefined) {
      payload.modelo = aircraftData.modelo;
    }
    if (aircraftData.identificador !== undefined) {
      payload.identificador = aircraftData.identificador;
    }
    if (aircraftData.assentos !== undefined) {
      payload.assentos = aircraftData.assentos;
    }
    if (aircraftData.estado !== undefined) {
      payload.estado = aircraftData.estado;
    }
    if (aircraftData.descricao !== undefined) {
      payload.descricao = aircraftData.descricao;
    }
    if (aircraftData.valor !== undefined) {
      payload.valor = aircraftData.valor;
    }
    if (aircraftData.currency !== undefined) {
      payload.currency = aircraftData.currency;
    }
    if (aircraftData.tipo_aeronave !== undefined) {
      payload.tipo_aeronave = aircraftData.tipo_aeronave;
    }
    if (specialist_id !== undefined) {
      payload.specialist_id = specialist_id ?? null;
    }

    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.AIRCRAFT,
        productId: id,
        nextValue: updateAircraftDto.valor,
        nextCurrency: updateAircraftDto.currency,
        data: payload,
        notFoundMessage: 'Aircraft not found',
      });

      // 1. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await client.aircraft_image.deleteMany({
          where: { aircraft_id: id },
        });

        // Adicionar referências das imagens já preparadas
        for (const image of preparedImages) {
          await client.aircraft_image.create({
            data: {
              aircraft_id: id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
      }

      // 3. Retornar a aeronave atualizada com imagens
      return await client.aircraft.findUnique({
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
      throw new Error(`Erro ao atualizar aeronave: ${error.message}`);
    }
  }

  async remove(
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ) {
    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.AIRCRAFT,
        productId: id,
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: null,
        },
        notFoundMessage: 'Aeronave não encontrada',
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new Error(`Erro ao deletar aeronave: ${error.message}`);
    }
  }

}
