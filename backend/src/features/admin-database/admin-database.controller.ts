import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AdminDatabaseService } from './admin-database.service';

// Navegador read-only da base de dados — só ADMIN.
@Controller('admin/database')
export class AdminDatabaseController {
  constructor(private readonly service: AdminDatabaseService) {}

  @Get('entities')
  @Roles(UserRole.ADMIN)
  entities() {
    return this.service.listEntities();
  }

  @Get(':entity')
  @Roles(UserRole.ADMIN)
  list(
    @Param('entity') entity: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.service.list(entity, Number(page) || 1, Number(pageSize) || 20);
  }
}
