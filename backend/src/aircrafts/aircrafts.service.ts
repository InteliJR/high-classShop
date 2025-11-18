import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsAircraftFilters,
  ExactAircraftFilters,
  FiltersAircraftMeta,
  RangeAircraftFilters,
} from 'src/shared/dto/filters.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AircraftsService {
  constructor(private prismaService: PrismaService) { }

  async create(data: CreateAircraftDto) {
    const { specialist_id, images, ...aircraftData } = data;

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

    return this.prismaService.aircraft.create({ data: payload });
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
    const skip = (page - 1) * perPage;

    // Separação dos filtros
    const where: any = {};
    // Exact
    const exactFilter: ExactAircraftFilters = {
      ...appliedFilters,
    };
    Object.assign(where, exactFilter);

    // Contains
    const containsFilter: ContainsAircraftFilters = {
      ...appliedFilters,
    };
    for (const [key, value] of Object.entries(containsFilter)) {
      where[key] = { contains: value, mode: 'insensitive' };
    }

    // Range
    const rangeFilters: RangeAircraftFilters = {
      ...appliedFilters,
    };
    const rangeMap = {
      ano: { gte: rangeFilters?.ano_max, lte: rangeFilters?.ano_min },
      preco: { gte: rangeFilters?.preco_max, lte: rangeFilters?.preco_min },
      assento: {
        gte: rangeFilters?.assentos_max,
        lte: rangeFilters?.assentos_min,
      },
    };
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      if (gte !== undefined && lte !== undefined) where[key] = {};
      if (gte !== undefined) where.gte = gte;
      if (lte !== undefined) where.lte = lte;
    }

    //Agrupamento das operações que serão realizadas no banco de dados
    const [aircrafts, total] = await this.prismaService.$transaction([
      this.prismaService.aircraft.findMany({
        skip: skip,
        take: take,
        where: where,
      }),
      this.prismaService.aircraft.count(),
    ]);

    return {
      data: aircrafts,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    const aircraft = await this.prismaService.aircraft.findUnique({ where: { id } });
    if (!aircraft) {
      throw new NotFoundException('Car not found');
    }
    return { ...aircraft };
  }


  // update(id: number, updateAircraftDto: UpdateAircraftDto) {
  //   return `This action updates a #${id} aircraft`;
  // }

  async update(id: number, data: UpdateAircraftDto) {
    await this.findOne(id);

    const { specialist_id, images, ...aircraftData } = data;
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

    return this.prismaService.aircraft.update({ where: { id }, data: payload });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prismaService.aircraft.delete({ where: { id } });
    return { ok: true };
  }
}
