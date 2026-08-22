import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AdminDatabaseService } from './admin-database.service';
import { AdminUserManagementService } from './admin-user-management.service';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeSpecialityDto } from './dto/change-speciality.dto';

// Navegador read-only da base de dados — só ADMIN.
@Controller('admin/database')
export class AdminDatabaseController {
  constructor(
    private readonly service: AdminDatabaseService,
    private readonly management: AdminUserManagementService,
  ) {}

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

  @Post('users/:id/role-change/validate')
  @Roles(UserRole.ADMIN)
  validateRoleChange(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.management.validateRoleChange(id, dto);
  }

  @Patch('users/:id/role-change')
  @Roles(UserRole.ADMIN)
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.management.changeRole(id, dto);
  }

  @Post('users/:id/speciality-change/validate')
  @Roles(UserRole.ADMIN)
  validateSpecialityChange(
    @Param('id') id: string,
    @Body() dto: ChangeSpecialityDto,
  ) {
    return this.management.validateSpecialityChange(id, dto);
  }

  @Patch('users/:id/speciality-change')
  @Roles(UserRole.ADMIN)
  changeSpeciality(@Param('id') id: string, @Body() dto: ChangeSpecialityDto) {
    return this.management.changeSpeciality(id, dto);
  }
}
