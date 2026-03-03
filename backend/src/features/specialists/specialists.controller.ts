import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { SpecialistsService } from './specialists.service';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';

/**
 * Define a rota base para este controlador.
 * Todas as rotas definidas aqui estarão sob o prefixo '/specialists'.
 */
@Controller('specialists')
export class SpecialistsController {
  /**
   * @param specialistsService - O serviço que contém a lógica de negócio para especialistas.
   */
  constructor(private readonly specialistsService: SpecialistsService) {}

  // ROTAS CRUD PARA ESPECIALISTAS

  // Rota para buscar todos os especialistas.
  @Get()
  findAll() {
    return this.specialistsService.findAll();
  }

  // Rota para buscar especialistas agrupados por categoria.
  @Get('grouped-by-category')
  findAllGroupedByCategory() {
    return this.specialistsService.findAllGroupedByCategory();
  }

  // Rota para criar um novo especialista.
  @Post()
  create(@Body() body: CreateSpecialistDto) {
    return this.specialistsService.create(body);
  }

  // Rota para buscar um único especialista pelo seu ID.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.specialistsService.findOne(id);
  }

  // Rota para atualizar os dados de um especialista.
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateSpecialistDto,
  ) {
    return this.specialistsService.update(id, body);
  }

  // Rota para apagar um especialista.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.specialistsService.remove(id);
  }
}
