import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDto } from 'src/utils/dto/query.dto';
import {
  ContainsAircraftFilters,
  ExactAircraftFilters,
  FiltersAircraftMeta,
  RangeAircraftFilters,
} from 'src/utils/dto/filters.dto';

@Injectable()
export class AircraftsService {
  constructor(private prismaService: PrismaService) { }

  create(data: {
    categoria: string;
    ano: number;
    marca: string;
    modelo: string;
    assentos: number;
    estado: string;
    descricao: string;
    valor: number;
    tipo_aeronave: string;
    specialist_id?: string; 
    images?: string;
  }) {

    return this.prismaService.aircraft.create({ data: data });
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

  async update(
    id: number,
    data: Partial<{
      categoria: string;
      ano: number;
      marca: string;
      modelo: string;
      assentos: number;
      estado: string;
      descricao: string;
      valor: number;
      tipo_aeronave: string
      specialist_id?: any | null;
      images?: string;
    }>,
  ) {
    await this.findOne(id);

    return this.prismaService.aircraft.update({ where: { id }, data: data });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prismaService.aircraft.delete({ where: { id } });
    return { ok: true };
  }
}
