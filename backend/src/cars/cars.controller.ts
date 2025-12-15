import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { QueryDto } from 'src/shared/dto/query.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FiltersCarMeta } from 'src/shared/dto/filters.dto';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Body() createCarDto: CreateCarDto) {
    return this.carsService.create(createCarDto);
  }

  @Get()
  async getAllCars(@Query() query: any) {
    // Extrai paginação e considera o restante como filtros
    let { page, perPage, ...rawFilters } = query;
    page = Number(page);
    perPage = Number(perPage);

    const appliedFilters: FiltersCarMeta = rawFilters;

    // Chama o serviço para obter os dados
    const { data, count, filters = {} } = await this.carsService.getAllCars({
      page,
      perPage,
      appliedFilters,
    });

    // Cálculo dos elementos já visualizados
    const skip = (page - 1) * perPage;

    // Atualiza os metadados de paginação
    const pagination = new PaginationDto();
    pagination.current_page = page;
    pagination.total_pages = count / perPage;
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;
    pagination.per_page = perPage;

    return {
      sucess: true,
      message: 'Carros listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
        filters: {
          applied_filters: filters,
          total_without_filters: count,
        }
      },
    };
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.carsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(+id, updateCarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carsService.remove(+id);
  }
}
