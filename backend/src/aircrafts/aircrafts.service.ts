import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AircraftsService {
  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  async create(createAircraftDto: CreateAircraftDto) {
    const { specialist_id, images, ...aircraftData } = createAircraftDto;

    const payload: Prisma.AircraftUncheckedCreateInput = {
      categoria: aircraftData.categoria,
      ano: aircraftData.ano,
      marca: aircraftData.marca,
      modelo: aircraftData.modelo,
      assentos: aircraftData.assentos,
      estado: aircraftData.estado,
      descricao: aircraftData.descricao,
      valor: aircraftData.valor,
      tipo_aeronave: aircraftData.tipo_aeronave,
      specialist_id: specialist_id ?? null,
    };

    try {
      // 1. Criar a aeronave
      const aircraft = await this.prismaService.aircraft.create({ data: payload });

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `aircrafts/${aircraft.id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

          await this.prismaService.aircraft_image.create({
            data: {
              aircraft_id: aircraft.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
      }

      // 3. Retornar a aeronave com as imagens
      return await this.prismaService.aircraft.findUnique({
        where: { id: aircraft.id },
        include: { images: true },
      });
    } catch (error) {
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
            }))
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
      })
    );

    return {
      data: aircraftsEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    const aircraft = await this.prismaService.aircraft.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!aircraft) {
      throw new NotFoundException('Car not found');
    }

    // Converter as keys do S3 em URLs assinadas
    if (aircraft.images && aircraft.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        aircraft.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        }))
      );
      return { ...aircraft, images: imagesWithUrls };
    }

    return { ...aircraft };
  }

  // update(id: number, updateAircraftDto: UpdateAircraftDto) {
  //   return `This action updates a #${id} aircraft`;
  // }

  async update(id: number, updateAircraftDto: UpdateAircraftDto) {
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
    if (aircraftData.tipo_aeronave !== undefined) {
      payload.tipo_aeronave = aircraftData.tipo_aeronave;
    }
    if (specialist_id !== undefined) {
      payload.specialist_id = specialist_id ?? null;
    }

    try {
      // 1. Atualizar dados da aeronave
      await this.prismaService.aircraft.update({ where: { id }, data: payload });

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

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

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
      throw new Error(`Erro ao atualizar aeronave: ${error.message}`);
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prismaService.aircraft.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar aeronave: ${error.message}`);
    }
  }
}
