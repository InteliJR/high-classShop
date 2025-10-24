import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ConsultantsService } from './consultants.service';
import { CreateConsultantDto } from './dto/create-consultant.dto';
import { UpdateConsultantDto } from './dto/update-consultant.dto';

/**
 * Define a rota base para este controlador.
 * Todas as rotas definidas aqui estarão sob o prefixo '/consultants'.
 */
@Controller('consultants')
export class ConsultantsController {
  /**
   * @param consultantsService - O serviço que contém a lógica de negócio para consultores.
   */
  constructor(private readonly consultantsService: ConsultantsService) {}

  // ROTAS CRUD PARA CONSULTORES

  // Rota para buscar todos os consultores.
  @Get()
  findAll() {
    return this.consultantsService.findAll();
  }

  // Rota para criar um novo consultor.
  @Post()
  create(@Body() body: CreateConsultantDto) {
    return this.consultantsService.create(body);
  }

  // Rota para buscar um único consultor pelo seu ID.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultantsService.findOne(id);
  }

  // Rota para atualizar os dados de um consultor.
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateConsultantDto,
  ) {
    return this.consultantsService.update(id, body);
  }

  // Rota para apagar um consultor.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.consultantsService.remove(id);
  }
}
