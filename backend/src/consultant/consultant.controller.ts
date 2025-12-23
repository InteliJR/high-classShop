import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConsultantService } from './consultant.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { ApiResponseDto } from '../shared/dto/api-response.dto';
import { ClientEntity } from './entity/client.entity';
import * as auth from '../auth/dto/auth';

@Controller('consultant')
export class ConsultantController {
  constructor(private readonly consultantService: ConsultantService) {}

  /**
   * Helper method to validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * GET /api/consultant/clients
   * List all clients for the authenticated consultant
   */
  @Get('clients')
  async findAllClients(@Request() req: auth.RequestWithUser): Promise<ApiResponseDto<ClientEntity[], any>> {
    const consultantId = req.user.id;
    const clients = await this.consultantService.findAllClients(consultantId);

    return {
      sucess: true,
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
      sucess: true,
      message: result.message,
      data: {
        email: result.email,
        registrationLink: result.registrationLink,
        warning: result.warning,
        messageId: result.messageId,
      },
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
        sucess: false,
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
      sucess: true,
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
        sucess: false,
        message: 'ID do cliente inválido. Deve ser um UUID válido.',
        data: null,
      };
    }

    const result = await this.consultantService.removeClient(consultantId, clientId);

    return {
      sucess: result.success,
      message: result.message,
      data: null,
    };
  }
}
