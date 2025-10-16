import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { CreateAircraftDto } from '../dto/create-aircraft.dto';
import { UpdateAircraftDto } from '../dto/update-aircraft.dto';
import { PaginationQueryDto } from 'src/dto/api-response/pagination-qery.dto';
import { PaginationDto } from 'src/dto/api-response/pagination.dto';

@Controller('aircrafts')
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Post()
  create(@Body() createAircraftDto: CreateAircraftDto) {
    return this.aircraftsService.create(createAircraftDto);
  }

  @Get()
    async getAllAircrafts(@Query() paginationQueryDto: PaginationQueryDto) {
      // Instancia a classe de paginação por chamada
      const { take = 10, skip = 0 } = paginationQueryDto;
  
      // Chama o serviço para obter os dados
      const { data, count } = await this.aircraftsService.getAllAircrafts({ take, skip });
  
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
        message: 'Aeronaves listados com sucesso',
        data: data,
        meta: {
          pagination: pagination,
        },
      };
    }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aircraftsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAircraftDto: UpdateAircraftDto) {
    return this.aircraftsService.update(+id, updateAircraftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aircraftsService.remove(+id);
  }
}
