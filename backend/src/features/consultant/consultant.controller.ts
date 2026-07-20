import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConsultantService } from './consultant.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { CreateConsultantProcessDto } from './dto/create-consultant-process.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ClientEntity } from './entity/client.entity';
import * as auth from 'src/auth/dto/auth';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ClientInviteJobsService } from './client-invite-jobs.service';

@Controller('consultant')
@Roles(UserRole.CONSULTANT)
export class ConsultantController {
  constructor(
    private readonly consultantService: ConsultantService,
    private readonly inviteJobs: ClientInviteJobsService,
  ) {}

  /**
   * Helper method to validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * GET /api/consultant/clients
   * List all clients for the authenticated consultant
   */
  @Get('clients')
  async findAllClients(
    @Request() req: auth.RequestWithUser,
  ): Promise<ApiResponseDto<ClientEntity[], any>> {
    const consultantId = req.user.id;
    const clients = await this.consultantService.findAllClients(consultantId);

    return {
      success: true,
      message: 'Clientes listados com sucesso',
      data: clients as ClientEntity[],
    };
  }

  /**
   * POST /api/consultant/invite
   * Send a registration/referral link to a potential client
   */
  @Post('invite')
  @HttpCode(HttpStatus.OK)
  async sendInvitation(
    @Request() req: auth.RequestWithUser,
    @Body() sendInvitationDto: SendInvitationDto,
  ): Promise<ApiResponseDto<any, any>> {
    const consultantId = req.user.id;
    const result = await this.consultantService.sendInvitation(
      consultantId,
      sendInvitationDto,
    );

    return {
      success: true,
      message: result.message,
      data: {
        email: result.email,
        registrationLink: result.registrationLink,
        warning: result.warning,
        messageId: result.messageId,
      },
    };
  }

  // ─── Convite de clientes em lote (CSV) ───────────────────────────────────
  @Post('invite-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 + 1 } }),
  )
  createInviteJob(
    @Request() req: auth.RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV obrigatório (campo "file")');
    return this.inviteJobs.createJobFromCsv(req.user.id, file.buffer);
  }

  @Get('invite-jobs')
  listInviteJobs(@Request() req: auth.RequestWithUser) {
    return this.inviteJobs.listJobs(req.user.id);
  }

  @Get('invite-jobs/:id')
  getInviteJob(@Request() req: auth.RequestWithUser, @Param('id') id: string) {
    return this.inviteJobs.getJobStatus(req.user.id, id);
  }

  /**
   * POST /api/consultant/processes
   * Create a process on behalf of a client
   */
  @Post('processes')
  @HttpCode(HttpStatus.CREATED)
  async createProcess(
    @Request() req: auth.RequestWithUser,
    @Body() dto: CreateConsultantProcessDto,
  ): Promise<ApiResponseDto<any, any>> {
    const process = await this.consultantService.createProcessForClient(
      req.user.id,
      dto,
    );
    return {
      success: true,
      message: 'Processo criado com sucesso',
      data: process,
    };
  }

  /**
   * GET /api/consultant/processes
   * Get all processes across all clients of the authenticated consultant
   */
  @Get('processes')
  async getAllProcesses(
    @Request() req: auth.RequestWithUser,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ): Promise<ApiResponseDto<any, any>> {
    const processes = await this.consultantService.getAllProcesses(
      req.user.id,
      {
        status,
        clientId,
      },
    );
    return {
      success: true,
      message: 'Processos listados com sucesso',
      data: processes,
    };
  }

  /**
   * GET /api/consultant/clients/:id/processes
   * Get all processes for a client belonging to the authenticated consultant
   */
  @Get('clients/:id/processes')
  async getClientProcesses(
    @Request() req: auth.RequestWithUser,
    @Param('id') clientId: string,
  ): Promise<ApiResponseDto<any, any>> {
    const processes = await this.consultantService.getClientProcesses(
      req.user.id,
      clientId,
    );
    return {
      success: true,
      message: 'Processos listados com sucesso',
      data: processes,
    };
  }

  /**
   * PUT /api/consultant/clients/:id
   * Update an existing client belonging to the authenticated consultant
   */
  @Put('clients/:id')
  async updateClient(
    @Request() req: auth.RequestWithUser,
    @Param('id') clientId: string,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<ApiResponseDto<ClientEntity, any>> {
    const consultantId = req.user.id;

    if (!this.isValidUUID(clientId)) {
      return {
        success: false,
        message: 'ID do cliente inválido. Deve ser um UUID válido.',
        data: null as any,
      };
    }

    const client = await this.consultantService.updateClient(
      consultantId,
      clientId,
      updateClientDto,
    );

    return {
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: client as ClientEntity,
    };
  }

  /**
   * DELETE /api/consultant/clients/:id
   * Remove a client belonging to the authenticated consultant
   */
  @Delete('clients/:id')
  @HttpCode(HttpStatus.OK)
  async removeClient(
    @Request() req: auth.RequestWithUser,
    @Param('id') clientId: string,
  ): Promise<ApiResponseDto<any, any>> {
    const consultantId = req.user.id;

    if (!this.isValidUUID(clientId)) {
      return {
        success: false,
        message: 'ID do cliente inválido. Deve ser um UUID válido.',
        data: null,
      };
    }

    const result = await this.consultantService.removeClient(
      consultantId,
      clientId,
    );

    return {
      success: result.success,
      message: result.message,
      data: null,
    };
  }
}
