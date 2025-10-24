import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDto } from 'src/utils/dto/query.dto';
import { ContainsCarFilters, ExactCarFilters, FiltersCarMeta, RangeCarFilters } from 'src/utils/dto/filters.dto';

@Injectable()
export class CarsService {
  constructor(private prismaService: PrismaService) { }

  create(data: {
    specialist?: string | null;
    marca: string;
    modelo: string;
    valor: number;
    estado: string;
    ano: number;
    descricao: string;
    cor: string;
    km: number;
    cambio: string;
    combustivel: string;
    tipo_categoria: string;
  }) {
    const formattedData: any = {
      marca: data.marca,
      modelo: data.modelo,
      valor: data.valor,
      estado: data.estado,
      ano: data.ano,
      descricao: data.descricao,
      cor: data.cor,
      km: data.km,
      cambio: data.cambio,
      combustivel: data.combustivel,
      tipo_categoria: data.tipo_categoria,
    };

    return this.prismaService.car.create({ data: formattedData });
  }


  async getAllCars({ page, perPage, appliedFilters }: QueryDto<FiltersCarMeta>) {
    // Cálculo das variáveis usadas na requisição ao banco de dados
    const take = perPage;
    const skip = (page - 1) * take;

    // Separação dos filtros
    const where: any = {}
    // Exact
    const exactFilter: ExactCarFilters = {
      ...appliedFilters
    };
    Object.assign(where, exactFilter); // Insere a filtragem exata na variavel where

    // Contains
    const containsFilter: ContainsCarFilters = {
      ...appliedFilters
    };
    // Insere a filtragem que usam contains na variável where
    for (const [key, value] of Object.entries(containsFilter)) {
      where[key] = { contains: value, mode: 'insensitive' };
    }

    // Range
    const rangeFilters: RangeCarFilters = {
      ...appliedFilters
    }
    const rangeMap = {
      "preco": { gte: rangeFilters.preco_min, lte: rangeFilters.preco_max },
      "ano": { gte: rangeFilters.ano_min, lte: rangeFilters.ano_max },
      "km": { gte: undefined, lte: rangeFilters.km_max },
    }
    // Insere a filtragem que são um intervalo na variável where
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      if (gte && lte != undefined) where[key] = {};
      if (gte != undefined || null) where[key].gte = gte;
      if (lte != undefined || null) where[key].lte = lte;
    }

    // Agrupamento de operações para serem realizadas no banco de dados
    const [cars, total] = await this.prismaService.$transaction([
      this.prismaService.car.findMany({
        skip: skip,
        take: take,
        where: where,
      }),
      this.prismaService.car.count(),
    ]);

    return {
      data: cars,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    const car = await this.prismaService.car.findUnique({ where: { id } });
    if (!car) {
      throw new NotFoundException('Car not found');
    }
    return { ...car };
  }

  async update(
    id: number,
    data: Partial<{
      specialist: string;
      marca: string;
      modelo: string;
      valor: number;
      estado: string;
      ano: number;
      descricao: string;
      cor: string;
      km: number;
      cambio: string;
      combustivel: string;
      tipo_categoria: string;
    }>,
  ) {
   await this.findOne(id);

    const formattedData: any = { ...data };

    if ('specialist' in formattedData) {
      if (formattedData.specialist) {
        formattedData.specialist = { connect: { id: formattedData.specialist } };
      } else {
        formattedData.specialist = { disconnect: true };
      }
    }

    return this.prismaService.car.update({ where: { id }, data: formattedData  });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prismaService.car.delete({ where: { id } });
    return { ok: true };
  }
}
