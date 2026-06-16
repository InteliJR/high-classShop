import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { RequestWithUser } from 'src/auth/dto/auth';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { OfficeScope } from 'src/shared/decorators/office-scope.decorator';
import { OfficeScopeGuard } from 'src/shared/guards/office-scope.guard';
import { ConsultantInviteJobsService } from './consultant-invite-jobs.service';
import { InviteConsultantDto } from './dto/invite-consultant.dto';
import { OfficeUpdateCompanyDto } from './dto/update-company.dto';
import { OfficeUpdateConsultantDto } from './dto/update-consultant.dto';
import { OfficeService } from './office.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (id: string, field = 'id') => {
  if (!UUID_RE.test(id)) throw new BadRequestException(`${field} inválido`);
};

interface OfficeScopeData {
  companyId: string | null;
  isAdmin: boolean;
}

/**
 * Endpoints do escritório (OFFICE) + bypass total para ADMIN.
 * OfficeScopeGuard popula req.officeScope { companyId, isAdmin } e bloqueia
 * outros roles. Todos os endpoints usam o scope p/ filtrar Prisma.
 */
@Controller('office')
@Roles(UserRole.OFFICE, UserRole.ADMIN)
@UseGuards(OfficeScopeGuard)
export class OfficeController {
  constructor(
    private readonly office: OfficeService,
    private readonly inviteJobs: ConsultantInviteJobsService,
  ) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────
  @Get('dashboard')
  dashboard(
    @OfficeScope() scope: OfficeScopeData,
    @Query('companyId') companyId?: string,
  ) {
    if (companyId) assertUuid(companyId, 'companyId');
    return this.office.dashboard(scope, companyId);
  }

  // ─── Company ───────────────────────────────────────────────────────────
  @Get('company')
  getCompany(
    @OfficeScope() scope: OfficeScopeData,
    @Query('companyId') companyId?: string,
  ) {
    if (companyId) assertUuid(companyId, 'companyId');
    return this.office.getCompany(scope, companyId);
  }

  @Patch('company')
  updateCompany(
    @OfficeScope() scope: OfficeScopeData,
    @Body() dto: OfficeUpdateCompanyDto,
    @Query('companyId') companyId?: string,
  ) {
    if (companyId) assertUuid(companyId, 'companyId');
    return this.office.updateCompany(scope, dto, companyId);
  }

  @Post('company/logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 2 * 1024 * 1024 + 1 } }),
  )
  uploadLogo(
    @OfficeScope() scope: OfficeScopeData,
    @UploadedFile() file: Express.Multer.File,
    @Query('companyId') companyId?: string,
  ) {
    if (!file)
      throw new BadRequestException(
        'Arquivo de logo obrigatório (campo "logo")',
      );
    if (companyId) assertUuid(companyId, 'companyId');
    return this.office.uploadCompanyLogo(scope, file, companyId);
  }

  // ─── Consultores ───────────────────────────────────────────────────────
  @Get('consultants')
  listConsultants(
    @OfficeScope() scope: OfficeScopeData,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    const onlyActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.office.listConsultants(scope, { onlyActive, q });
  }

  @Patch('consultants/:id')
  updateConsultant(
    @OfficeScope() scope: OfficeScopeData,
    @Param('id') id: string,
    @Body() dto: OfficeUpdateConsultantDto,
  ) {
    assertUuid(id);
    return this.office.updateConsultant(scope, id, dto);
  }

  @Delete('consultants/:id')
  @HttpCode(HttpStatus.OK)
  deactivateConsultant(
    @OfficeScope() scope: OfficeScopeData,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    return this.office.deactivateConsultant(scope, id, req.user.id);
  }

  @Post('consultants/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateConsultant(
    @OfficeScope() scope: OfficeScopeData,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    return this.office.reactivateConsultant(scope, id);
  }

  // ─── Convite consultor individual ──────────────────────────────────────
  @Post('consultants/invite')
  @HttpCode(HttpStatus.OK)
  inviteConsultant(
    @OfficeScope() scope: OfficeScopeData,
    @Body() dto: InviteConsultantDto,
    @Query('companyId') companyId?: string,
  ) {
    if (companyId) assertUuid(companyId, 'companyId');
    return this.office.inviteConsultant(scope, dto, companyId);
  }

  // ─── Clientes (read-only) ──────────────────────────────────────────────
  @Get('clients')
  listClients(
    @OfficeScope() scope: OfficeScopeData,
    @Query('consultantId') consultantId?: string,
    @Query('q') q?: string,
  ) {
    if (consultantId) assertUuid(consultantId, 'consultantId');
    return this.office.listClients(scope, { consultantId, q });
  }

  // ─── Batch invite jobs ─────────────────────────────────────────────────
  @Post('invite-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 + 1 } }),
  )
  createInviteJob(
    @OfficeScope() scope: OfficeScopeData,
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('companyId') companyId?: string,
  ) {
    if (!file) throw new BadRequestException('CSV obrigatório (campo "file")');
    if (companyId) assertUuid(companyId, 'companyId');
    return this.inviteJobs.createJobFromCsv(
      scope,
      req.user.id,
      file.buffer,
      companyId,
    );
  }

  @Get('invite-jobs')
  listInviteJobs(
    @OfficeScope() scope: OfficeScopeData,
    @Query('companyId') companyId?: string,
  ) {
    if (companyId) assertUuid(companyId, 'companyId');
    return this.inviteJobs.listJobs(scope, companyId);
  }

  @Get('invite-jobs/:id')
  getInviteJob(@OfficeScope() scope: OfficeScopeData, @Param('id') id: string) {
    assertUuid(id);
    return this.inviteJobs.getJobStatus(scope, id);
  }
}
