import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

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
    // Busca todas as empresas
    return this.companiesService.findAll();
  }

  // Rota para criar um novo escritório.
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.companiesService.create(body);
  }

  // Rota para buscar consultores de um escritório (lazy loading com paginação).
  @Get(':id/consultants')
  findConsultants(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.companiesService.findConsultantsByCompany(
      id,
      page ? Number(page) : 1,
      perPage ? Number(perPage) : 5,
    );
  }

  // Rota para buscar um único escritório pelo seu ID.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  // Rota para atualizar os dados de um escritório.
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateCompanyDto) {
    return this.companiesService.update(id, body);
  }

  // Rota para gerar link de convite de consultor para um escritório.
  @Post(':id/invite-consultant')
  @HttpCode(HttpStatus.OK)
  inviteConsultant(
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.companiesService.inviteConsultant(id, email);
  }

  // Rota para gerar link de convite de gerente OFFICE — exclusivo do ADMIN.
  @Roles(UserRole.ADMIN)
  @Post(':id/invite-office')
  @HttpCode(HttpStatus.OK)
  inviteOffice(
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.companiesService.inviteOffice(id, email);
  }

  // Rota para apagar um escritório.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
