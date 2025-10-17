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
import { PaginationQueryDto } from 'src/utils/dto/pagination-qery.dto';
import { PaginationDto } from 'src/utils/dto/pagination.dto';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Body() createCarDto: CreateCarDto) {
    return this.carsService.create(createCarDto);
  }

  @Get()
  async getAllCars(@Query() paginationQueryDto: PaginationQueryDto) {
    // Instancia a classe de paginação por chamada
    const { take = 10, skip = 0 } = paginationQueryDto;

    // Chama o serviço para obter os dados
    const { data, count } = await this.carsService.getAllCars({ take, skip });

    // Cálculo de metadados
    const currentPage = Math.floor(skip / take) + 1;
    const totalPages = Math.ceil(count / take);

    // Atualiza os metadados de paginação
    const pagination = new PaginationDto();
    pagination.current_page = currentPage;
    pagination.total_pages = totalPages;
    pagination.has_next = skip + take < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;
    pagination.per_page = take;

    return {
      sucess: true,
      message: 'Carros listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
      },
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(+id, updateCarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carsService.remove(+id);
  }
}
