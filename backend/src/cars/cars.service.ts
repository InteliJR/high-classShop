import { Injectable } from '@nestjs/common';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDto } from 'src/utils/dto/query.dto';
import { ContainsCarFilters, ExactCarFilters, FiltersCarMeta, RangeCarFilters } from 'src/utils/dto/filters.dto';

@Injectable()
export class CarsService {
  constructor(private prismaService: PrismaService) {}

  create(createCarDto: CreateCarDto) {
    return 'This action adds a new car';
  }

  async getAllCars({ page, perPage, appliedFilters }: QueryDto<FiltersCarMeta>) {
    // Cálculo das variáveis usadas na requisição ao banco de dados
    const take = perPage;
    const skip = (page - 1) * take;

    // Separação dos filtros
    const where: any = {}
    // Exact
    const exactFilter:ExactCarFilters = {
      ...appliedFilters
    } ;
    Object.assign(where, exactFilter); // Insere a filtragem exata na variavel where

    // Contains
    const containsFilter:ContainsCarFilters = {
      ...appliedFilters
    };
    // Insere a filtragem que usam contains na variável where
    for( const [key, value] of Object.entries(containsFilter)) {
      where[key] = { contains: value, mode: 'insensitive'};
    }

    // Range
    const rangeFilters:RangeCarFilters = {
      ...appliedFilters
    }
    const rangeMap = {
      "preco": { gte: rangeFilters.preco_min, lte: rangeFilters.preco_max},
      "ano": {gte: rangeFilters.ano_min, lte: rangeFilters.ano_max},
      "km": {gte: undefined, lte: rangeFilters.km_max},
    }
    // Insere a filtragem que são um intervalo na variável where
    for ( const [key, {gte, lte}] of Object.entries(rangeMap)) {
      if( gte && lte != undefined) where[key] = {};
      if(gte != undefined || null) where[key].gte = gte;
      if(lte != undefined || null ) where[key].lte = lte;
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

  findOne(id: number) {
    return `This action returns a #${id} car`;
  }

  update(id: number, updateCarDto: UpdateCarDto) {
    return `This action updates a #${id} car`;
  }

  remove(id: number) {
    return `This action removes a #${id} car`;
  }
}
