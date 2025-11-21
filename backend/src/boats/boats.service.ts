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
import { Boat } from './entity/boat.entity';

@Injectable()
export class BoatsService {
  constructor(private prismaService: PrismaService) {}

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
    const skip = page && take ? (page - 1) * take : 0;

    //Exact
    const where: any = {};
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

    // Range
    const rangeFilter: RangeBoatFilters = {
      ano_max: appliedFilters?.ano_max,
      ano_min: appliedFilters?.ano_min,
      preco_max: appliedFilters?.preco_max,
      preco_min: appliedFilters?.preco_min,
    };
    // Objeto para orientar o where que utiliza gte e lte
    const rangeMap = {
      ano: { gte: rangeFilter.ano_max, lte: rangeFilter.ano_min },
      preco: { gte: rangeFilter.preco_max, lte: rangeFilter.preco_min },
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

    // Agrupamento das operções para serem realizadas no banco de dados
    const [boats, total] = await this.prismaService.$transaction([
      this.prismaService.boat.findMany({
        skip: skip,
        take: take,
        where: where,
        include: {
          images: true,
          specialist: true,
        },
      }),
      this.prismaService.boat.count(),
    ]);

    const boatEntities: Boat[] = boats.map((boat) => ({
      ...boat,
      descricao: boat.descricao_completa,
      valor: boat.valor.toNumber(),
      images: boat.images || [],
    }));

    return {
      data: boatEntities,
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
