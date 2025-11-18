import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsBoatFilters,
  ExactBoatFilters,
  FiltersBoatMeta,
  RangeBoatFilters,
} from 'src/shared/dto/filters.dto';

@Injectable()
export class BoatsService {
  constructor(private prismaService: PrismaService) { }

  create(data: {
    marca: string;
    modelo: string;
    valor: number;
    estado: string;
    ano: number;
    fabricante: string;
    tamanho: string;
    estilo: string;
    combustivel: string;
    motor: string;
    ano_motor: number;
    tipo_embarcacao: string;
    descricao_completa: string;
    acessorios: string;
    specialist_id?: string;

  }) {

    return this.prismaService.boat.create({ data: data });
  }

  async getAllBoats({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersBoatMeta>) {
    // Cálculo das variáveis que serão utilizadas na requisição ao banco de dados
    const take = perPage;
    const skip = (page - 1) * perPage;

    //Exact
    const where: any = {};
    const exactFilter: ExactBoatFilters = {
      estado: appliedFilters?.estado,
      tipo_embarcacao: appliedFilters?.tipo_embarcacao,
    };
    Object.assign(where, exactFilter);

    //Contains
    const containsFilter: ContainsBoatFilters = {
      ...appliedFilters,
    };
    for (const [key, value] of Object.entries(containsFilter)) {
      where[key] = { contains: value, mode: 'insensitive' };
    }

    // Range
    const rangeFilter: RangeBoatFilters = {
      ...appliedFilters,
    };
    const rangeMap = {
      ano: { gte: rangeFilter.ano_max, lte: rangeFilter.ano_min },
      preco: { gte: rangeFilter.preco_max, lte: rangeFilter.preco_min },
    };
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      if (gte && lte !== undefined) where[key] = {};
      if (gte !== undefined) where[key].gte = gte;
      if (lte !== undefined) where[key].lte = lte;
    }

    // Agrupamento das operções para serem realizadas no banco de dados
    const [boats, total] = await this.prismaService.$transaction([
      this.prismaService.boat.findMany({
        skip: skip,
        take: take,
        where: where,
      }),
      this.prismaService.boat.count(),
    ]);

    return {
      data: boats,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {

    const boat = await this.prismaService.boat.findUnique({ where: { id } });
    if (!boat) {
      throw new NotFoundException('Boat not found');
    }
    return { ...boat };
  }

  async update(
    id: number,
    data: Partial<{
      marca: string;
      modelo: string;
      valor: number;
      estado: string;
      ano: number;
      fabricante: string;
      tamanho: string;
      estilo: string;
      combustivel: string;
      motor: string;
      ano_motor: number;
      tipo_embarcacao: string;
      descricao_completa: string;
      acessorios: string;
      specialist_id?: string;
    }>,
  ) {
    await this.findOne(id);

    return this.prismaService.boat.update({ where: { id }, data: data });
  }


  async remove(id: number) {
    await this.findOne(id);
    await this.prismaService.boat.delete({ where: { id } });
    return { ok: true };
  }
}
