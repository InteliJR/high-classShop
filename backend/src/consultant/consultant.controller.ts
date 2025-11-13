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
  Headers,
} from '@nestjs/common';
import { ConsultantService } from './consultant.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { ApiResponseDto } from '../utils/dto/api-response.dto';
import { ClientEntity } from './entity/client.entity';

@Controller('api/consultant')
export class ConsultantController {
  constructor(private readonly consultantService: ConsultantService) {}

  /**
   * GET /api/consultant/clients
   * List all clients for the authenticated consultant
   * 
   * TODO: Replace x-consultant-id header with actual JWT authentication
   * Once authentication is implemented, extract consultant_id from JWT token
   */
  @Get('clients')
  async findAllClients(
    @Headers('x-consultant-id') consultantId: string,
  ): Promise<ApiResponseDto<ClientEntity[], any>> {
    // TODO: Remove this validation once JWT is implemented
    if (!consultantId) {
      return {
        sucess: false,
        message: 'ID do assessor não fornecido. Use o header x-consultant-id temporariamente.',
        data: [],
      };
    }

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
   * 
   * TODO: Replace x-consultant-id header with actual JWT authentication
   */
  @Post('invite')
  @HttpCode(HttpStatus.OK)
  async sendInvitation(
    @Headers('x-consultant-id') consultantId: string,
    @Body() sendInvitationDto: SendInvitationDto,
  ): Promise<ApiResponseDto<any, any>> {
    // TODO: Remove this validation once auth is implemented
    if (!consultantId) {
      return {
        sucess: false,
        message: 'ID do assessor não fornecido. Use o header x-consultant-id temporariamente.',
        data: null,
      };
    }

    const result = await this.consultantService.sendInvitation(
      consultantId,
      sendInvitationDto,
    );

    return {
      sucess: true,
      message: result.message,
      data: {
        email: result.email,
        messageId: result.messageId,
      },
    };
  }

  /**
   * PUT /api/consultant/clients/:id
   * Update an existing client belonging to the authenticated consultant
   * 
   * TODO: Replace x-consultant-id header with actual JWT authentication
   */
  @Put('clients/:id')
  async updateClient(
    @Headers('x-consultant-id') consultantId: string,
    @Param('id') clientId: string,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<ApiResponseDto<ClientEntity, any>> {
    // TODO: Remove this validation once JWT is implemented
    if (!consultantId) {
      return {
        sucess: false,
        message: 'ID do assessor não fornecido. Use o header x-consultant-id temporariamente.',
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
   * 
   * TODO: Replace x-consultant-id header with actual JWT authentication
   */
  @Delete('clients/:id')
  @HttpCode(HttpStatus.OK)
  async removeClient(
    @Headers('x-consultant-id') consultantId: string,
    @Param('id') clientId: string,
  ): Promise<ApiResponseDto<any, any>> {
    // TODO: Remove this validation once JWT is implemented
    if (!consultantId) {
      return {
        sucess: false,
        message: 'ID do assessor não fornecido. Use o header x-consultant-id temporariamente.',
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
