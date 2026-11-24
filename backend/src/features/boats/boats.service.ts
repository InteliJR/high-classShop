import {
  HttpException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsBoatFilters,
  ExactBoatFilters,
  FiltersBoatMeta,
} from 'src/shared/dto/filters.dto';
import { updateProductWithMonetaryLock } from '../products/product-monetary-lock';
import { publicBoatSelect } from 'src/shared/selects/public-catalog.select';
import { randomUUID } from 'node:crypto';
import {
  cleanupPreparedProductImages,
  prepareProductImages,
  PreparedProductImage,
  ProductImageInput,
} from '../products/product-image-preparation';
import { buildProductSearchConditions } from 'src/shared/helpers/product-search.helper';
import { applyRangeFilters } from 'src/shared/helpers/product-range.helper';

@Injectable()
export class BoatsService {
  private readonly logger = new Logger(BoatsService.name);


  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  prepareProductImages(productId: string, images?: ProductImageInput[]) {
    return prepareProductImages(this.s3Service, 'boats', productId, images);
  }

  cleanupPreparedImages(images: PreparedProductImage[]) {
    return cleanupPreparedProductImages(this.s3Service, images);
  }

  async create(
    createBoatDto: CreateBoatDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: {
      productId: string;
      images: PreparedProductImage[];
    },
  ) {
    this.logger.log('[create] Iniciando criação de novo barco');
    const { images, ...boatData } = createBoatDto;
    const productId = preparedWrite?.productId ?? randomUUID();
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ??
      (await this.prepareProductImages(productId, images));

    try {
      // 1. Criar o barco
      this.logger.debug(
        `[create] Criando barco: ${boatData.marca} ${boatData.modelo}`,
      );
      const boat = await client.boat.create({
        data: { ...boatData, id: productId },
      });
      this.logger.log(`[create] Barco criado com sucesso - ID: ${boat.id}`);

      // 2. Persistir somente referências já preparadas fora da transação
      if (preparedImages.length > 0) {
        this.logger.log(
          `[create] Persistindo ${preparedImages.length} imagens para o barco ${boat.id}`,
        );
        for (const image of preparedImages) {
          await client.boat_image.create({
            data: {
              boat_id: boat.id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'BOAT',
            },
          });
        }
        this.logger.log(
          `[create] Todas as ${preparedImages.length} imagens persistidas com sucesso`,
        );
      }

      // 3. Retornar o barco com as imagens
      const boatWithImages = await client.boat.findUnique({
        where: { id: boat.id },
        include: { images: true },
      });
      if (!boatWithImages) {
        throw new Error('Erro ao buscar barco criado');
      }
      this.logger.log(
        `[create] Barco ${boat.id} criado com sucesso com ${boatWithImages.images.length} imagens`,
      );
      return boatWithImages;
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
        `[create] Erro ao criar barco: ${error.message}`,
        error.stack,
      );
      throw new Error(`Erro ao criar barco: ${error.message}`);
    }
  }

  async getAllBoats({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersBoatMeta>, includeInactive = false) {
    // Cálculo das variáveis que serão utilizadas na requisição ao banco de dados
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    //Exact
    const where: any = {};
    if (!includeInactive) where.is_active = true;
    const exacts: ExactBoatFilters = {
      estado: appliedFilters?.estado,
      tipo_embarcacao: appliedFilters?.tipo_embarcacao,
      combustivel: appliedFilters?.combustivel,
      tamanho: appliedFilters?.tamanho,
    };
    // Insere a filtragem na variável where
    for (const [key, value] of Object.entries(exacts)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    //Contains
    const contains: ContainsBoatFilters = {
      fabricante: appliedFilters?.fabricante,
      marca: appliedFilters?.marca,
      modelo: appliedFilters?.modelo,
      motor: appliedFilters?.motor,
    };
    // Insere a filtragem na variǘel where
    for (const [key, value] of Object.entries(contains)) {
      if (value !== undefined && value !== null) {
        where[key] = { contains: value, mode: 'insensitive' };
      }
    }

    // Range: antes o min/max estavam invertidos e o preço apontava para
    // `preco`, coluna que não existe (é `valor`).
    applyRangeFilters(where, {
      ano: {
        min: appliedFilters?.ano_min,
        max: appliedFilters?.ano_max,
        integer: true,
      },
      valor: { min: appliedFilters?.preco_min, max: appliedFilters?.preco_max },
    });

    // Filtro por especialista (usado na tela "Meus Produtos")
    if (appliedFilters?.specialist_id) {
      where.specialist_id = appliedFilters.specialist_id;
    }

    // Busca textual (marca/modelo e ano exato) — usada na "Gestão de Produtos".
    // Nenhum outro filtro usa `OR`; se passar a usar, combinar via `AND`.
    const searchConditions = buildProductSearchConditions(
      appliedFilters?.search,
    );
    if (searchConditions) {
      where.OR = searchConditions;
    }

    // Agrupamento das operções para serem realizadas no banco de dados
    const [boats, total] = await this.prismaService.$transaction([
      this.prismaService.boat.findMany({
        skip: skip,
        take: take,
        where: where,
        // Ordem estável para a paginação não repetir/pular itens.
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        select: publicBoatSelect,
      }),
      this.prismaService.boat.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada barco
    const boatEntities = await Promise.all(
      boats.map(async (boat) => {
        let imagesWithUrls: any[] = [];
        if (boat.images && boat.images.length > 0) {
          imagesWithUrls = await Promise.all(
            boat.images.map(async (image) => ({
              ...image,
              image_url: await this.s3Service.getSignedUrl(image.image_url),
            })),
          );
        }

        return {
          ...boat,
          descricao: boat.descricao_completa,
          valor: boat.valor.toNumber(),
          images: imagesWithUrls,
          specialist: boat.specialist,
        };
      }),
    );

    return {
      data: boatEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: string) {
    this.logger.log(`[findOne] Buscando barco - ID: ${id}`);
    const boat = await this.prismaService.boat.findUnique({
      where: { id },
      select: publicBoatSelect,
    });
    if (!boat) {
      this.logger.warn(`[findOne] Barco não encontrado - ID: ${id}`);
      throw new NotFoundException('Boat not found');
    }
    this.logger.log(`[findOne] Barco encontrado - ID: ${id}`);

    // Converter as keys do S3 em URLs assinadas
    if (boat.images && boat.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        boat.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        })),
      );
      return {
        ...boat,
        valor: boat.valor.toNumber(),
        images: imagesWithUrls,
      };
    }

    return { ...boat, valor: boat.valor.toNumber() };
  }

  async update(
    id: string,
    updateBoatDto: UpdateBoatDto,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
    preparedWrite?: { images: PreparedProductImage[] },
  ) {
    const { images, ...boatData } = updateBoatDto;
    const ownsPreparedImages = !preparedWrite;
    const preparedImages =
      preparedWrite?.images ?? (await this.prepareProductImages(id, images));

    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.BOAT,
        productId: id,
        nextValue: updateBoatDto.valor,
        nextCurrency: updateBoatDto.currency,
        data: boatData,
        notFoundMessage: 'Boat not found',
      });

      // 1. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await client.boat_image.deleteMany({
          where: { boat_id: id },
        });

        // Adicionar referências das imagens já preparadas
        for (const image of preparedImages) {
          await client.boat_image.create({
            data: {
              boat_id: id,
              image_url: image.image_url,
              is_primary: image.is_primary,
              product_type: 'BOAT',
            },
          });
        }
      }

      // 2. Retornar o barco atualizado com imagens
      return await client.boat.findUnique({
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
      throw new Error(`Erro ao atualizar lancha: ${error.message}`);
    }
  }

  async remove(
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ) {
    try {
      await updateProductWithMonetaryLock(client, {
        productType: ProductType.BOAT,
        productId: id,
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: null,
        },
        notFoundMessage: 'Lancha não encontrada',
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new Error(`Erro ao deletar lancha: ${error.message}`);
    }
  }

}
