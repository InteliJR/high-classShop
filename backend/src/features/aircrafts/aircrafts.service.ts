import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
import { Prisma } from '@prisma/client';
import { Aircraft } from './entity/aircraft.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import { AIRCRAFT_COLUMNS } from 'src/shared/constants/product-columns';

@Injectable()
export class AircraftsService {
  private readonly logger = new Logger(AircraftsService.name);

  // Colunas da planilha de aeronaves — fonte única em shared/constants/product-columns.ts
  private readonly xlsxColumns = AIRCRAFT_COLUMNS;

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  async create(createAircraftDto: CreateAircraftDto) {
    this.logger.log('[create] Iniciando criação de nova aeronave');
    const { specialist_id, images, ...aircraftData } = createAircraftDto;

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
    };

    try {
      // 1. Criar a aeronave
      this.logger.debug(
        `[create] Criando aeronave: ${aircraftData.marca} ${aircraftData.modelo}`,
      );
      const aircraft = await this.prismaService.aircraft.create({
        data: payload,
      });
      this.logger.log(
        `[create] Aeronave criada com sucesso - ID: ${aircraft.id}`,
      );

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        this.logger.log(
          `[create] Processando ${images.length} imagens para a aeronave ${aircraft.id}`,
        );
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `aircrafts/${aircraft.id}/${timestamp}-${i}.jpg`;

          this.logger.debug(
            `[create] Fazendo upload da imagem ${i + 1}/${images.length} para S3`,
          );
          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

          await this.prismaService.aircraft_image.create({
            data: {
              aircraft_id: aircraft.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
          this.logger.debug(`[create] Imagem ${i + 1} salva com sucesso`);
        }
        this.logger.log(
          `[create] Todas as ${images.length} imagens processadas com sucesso`,
        );
      }

      // 3. Retornar a aeronave com as imagens
      const aircraftWithImages = await this.prismaService.aircraft.findUnique({
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
  }: QueryDto<FiltersAircraftMeta>) {
    // Cálculo das variáveis que serão utilizadas
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Separação dos filtros
    const where: any = {};
    where.is_active = true;

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
        include: {
          images: true,
          specialist: true,
        },
      }),
      this.prismaService.aircraft.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada aeronave
    const aircraftsEntities: Aircraft[] = await Promise.all(
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
          specialist: aircraft.specialist
            ? UserEntity.fromPrisma(aircraft.specialist)
            : null,
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
      include: { images: true },
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
      return { ...aircraft, images: imagesWithUrls };
    }

    return { ...aircraft };
  }

  // update(id: string, updateAircraftDto: UpdateAircraftDto) {
  //   return `This action updates a #${id} aircraft`;
  // }

  async update(id: string, updateAircraftDto: UpdateAircraftDto) {
    await this.findOne(id);

    const { specialist_id, images, ...aircraftData } = updateAircraftDto;
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
      // 1. Atualizar dados da aeronave
      await this.prismaService.aircraft.update({
        where: { id },
        data: payload,
      });

      // 2. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await this.prismaService.aircraft_image.deleteMany({
          where: { aircraft_id: id },
        });

        // Adicionar novas imagens
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `aircrafts/${id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

          await this.prismaService.aircraft_image.create({
            data: {
              aircraft_id: id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
      }

      // 3. Retornar a aeronave atualizada com imagens
      return await this.prismaService.aircraft.findUnique({
        where: { id },
        include: { images: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw error;
      }
      throw new Error(`Erro ao atualizar aeronave: ${error.message}`);
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    try {
      await this.prismaService.aircraft.update({
        where: { id },
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: null,
        },
      });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar aeronave: ${error.message}`);
    }
  }

  async getCsvTemplate(): Promise<Buffer> {
    const headers = this.xlsxColumns.map((column) => column.name).join(';');
    const exampleValues = [
      'Embraer-Phenom 300-1',
      'Embraer',
      'Phenom 300',
      '15000000',
      'BRL',
      'São Paulo',
      '2021',
      'Light Jet',
      '8',
      'Jato Executivo',
      'Aeronave com baixas horas de voo e interior renovado',
      'https://drive.google.com/drive/folders/SEU_FOLDER_ID',
    ].join(';');

    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from(`${headers}\n${exampleValues}\n`, 'utf-8');
    return Buffer.concat([BOM, content]);
  }
}
