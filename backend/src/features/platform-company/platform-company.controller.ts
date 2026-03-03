import { Controller, Get, Put, Body } from '@nestjs/common';
import { PlatformCompanyService } from './platform-company.service';
import { UpdatePlatformCompanyDto } from './dto/update-platform-company.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Controlador da empresa da plataforma.
 * GET: acessível a todos os usuários autenticados
 * PUT: restrito ao ADMIN
 */
@Controller('platform-company')
export class PlatformCompanyController {
  constructor(
    private readonly platformCompanyService: PlatformCompanyService,
  ) {}

  // Retorna os dados da empresa da plataforma
  @Get()
  findOne() {
    return this.platformCompanyService.findOne();
  }

  // Atualiza os dados da empresa da plataforma (somente ADMIN)
  @Put()
  @Roles(UserRole.ADMIN)
  update(@Body() body: UpdatePlatformCompanyDto) {
    return this.platformCompanyService.update(body);
  }
}
