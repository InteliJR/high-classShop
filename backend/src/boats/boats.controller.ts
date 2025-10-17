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
import { PaginationQueryDto } from 'src/utils/dto/pagination-qery.dto';
import { PaginationDto } from 'src/utils/dto/pagination.dto';

@Controller('boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Post()
  create(@Body() createBoatDto: CreateBoatDto) {
    return this.boatsService.create(createBoatDto);
  }

  @Get()
  async getAllBoats(@Query() paginationQueryDto: PaginationQueryDto) {
    // Instancia a classe de paginação por chamada
    const { take = 10, skip = 0 } = paginationQueryDto;

    // Chama o serviço para obter os dados
    const { data, count } = await this.boatsService.getAllBoats({ take, skip });

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
      message: 'Barcos listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
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
