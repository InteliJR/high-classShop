import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SpecialistsService } from './specialists.service';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

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
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateSpecialistDto) {
    return this.specialistsService.create(body);
  }

  // Rota para convidar um especialista (admin gera link de auto-cadastro).
  @Post('invite')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async inviteSpecialist(
    @Body() body: { email: string; speciality: 'CAR' | 'BOAT' | 'AIRCRAFT' },
  ) {
    if (!body.email || !body.speciality) {
      throw new BadRequestException('Email e especialidade são obrigatórios');
    }
    const result = await this.specialistsService.inviteSpecialist(
      body.email,
      body.speciality,
    );
    return {
      success: true,
      message: 'Convite enviado com sucesso',
      data: result,
    };
  }

  // Rota para buscar um único especialista pelo seu ID.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.specialistsService.findOne(id);
  }

  // Rota para atualizar os dados de um especialista.
  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateSpecialistDto) {
    return this.specialistsService.update(id, body);
  }

  // Rota para apagar um especialista.
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.specialistsService.remove(id);
  }
}
