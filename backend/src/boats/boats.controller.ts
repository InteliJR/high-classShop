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
import { BoatsService } from './boats.service';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { QueryDto } from 'src/shared/dto/query.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FiltersBoatMeta } from 'src/shared/dto/filters.dto';

@Controller('boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Post()
  create(@Body() createBoatDto: CreateBoatDto) {
    return this.boatsService.create(createBoatDto);
  }

  @Get()
  async getAllBoats(@Query() { page, perPage, appliedFilters }: QueryDto<FiltersBoatMeta>) {
    // Tratamento das varíaveis recebidas do front
    page = Number(page);
    perPage = Number(perPage);

    // Chama o serviço para obter os dados
    const { data, count, filters = {} } = await this.boatsService.getAllBoats({
      page,
      perPage,
      appliedFilters
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
      message: 'Barcos listados com sucesso',
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
  findOne(@Param('id') id: string) {
    return this.boatsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBoatDto: UpdateBoatDto) {
    return this.boatsService.update(+id, updateBoatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.boatsService.remove(+id);
  }
}
