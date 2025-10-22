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
import { AircraftsService } from './aircrafts.service';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { QueryDto } from 'src/utils/dto/query.dto';
import { PaginationDto } from 'src/utils/dto/pagination.dto';
import { FiltersAircraftMeta } from 'src/utils/dto/filters.dto';

@Controller('aircrafts')
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Post()
  create(@Body() createAircraftDto: CreateAircraftDto) {
    return this.aircraftsService.create(createAircraftDto);
  }

  @Get()
  async getAllAircrafts(
    @Query() { page, perPage, appliedFilters }: QueryDto<FiltersAircraftMeta>,
  ) {
    //Tratamento das variáveis recebidas do front
    page = Number(page);
    perPage = Number(perPage);

    // Chama o serviço para obter os dados
    const {
      data,
      count,
      filters = {},
    } = await this.aircraftsService.getAllAircrafts({
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
      message: 'Aeronaves listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
        filters: {
          total_without_filters: count,
          applied_filters: filters,
        },
      },
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aircraftsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAircraftDto: UpdateAircraftDto,
  ) {
    return this.aircraftsService.update(+id, updateAircraftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aircraftsService.remove(+id);
  }
}
