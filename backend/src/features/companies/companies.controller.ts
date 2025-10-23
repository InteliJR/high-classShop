import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * Define a rota base para este controlador.
 * Todas as rotas definidas aqui estarão sob o prefixo '/companies'.
 */
@Controller('companies')
export class CompaniesController {
  /**
   * @param companiesService - O serviço que contém a lógica de negócio para empresas.
   */
  constructor(private readonly companiesService: CompaniesService) {}

  // ROTAS CRUD PARA ESCRITÓRIOS

  // Rota para buscar todos os escritórios.
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  // Rota para criar um novo escritório.
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.companiesService.create(body);
  }

  // Rota para buscar um único escritório pelo seu ID.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  // Rota para atualizar os dados de um escritório.
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, body);
  }

  // Rota para apagar um escritório.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
