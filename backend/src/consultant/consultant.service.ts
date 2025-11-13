import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { SesService } from '../aws/ses.service';

@Injectable()
export class ConsultantService {
  constructor(
    private prismaService: PrismaService,
    private sesService: SesService,
  ) {}

  /**
   * List all clients for a specific consultant
   * @param consultantId - The ID of the consultant
   */
  async findAllClients(consultantId: string) {
    const clients = await this.prismaService.user.findMany({
      where: {
        consultant_id: consultantId,
        role: 'CUSTOMER', // Only customers can be clients
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        cpf: true,
        rg: true,
        civil_state: true,
        address_id: true,
        consultant_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return clients;
  }

  /**
   * Send registration/referral link to a potential client
   * @param consultantId - The ID of the consultant
   * @param sendInvitationDto - Email of the potential client
   * @throws NotFoundException if consultant not found
   * @throws BadRequestException if email is invalid or disposable
   * @throws InternalServerErrorException if email sending fails
   */
  async sendInvitation(
    consultantId: string,
    sendInvitationDto: SendInvitationDto,
  ) {
    // Get consultant information for email personalization
    const consultant = await this.prismaService.user.findUnique({
      where: {
        id: consultantId,
      },
      select: {
        name: true,
        surname: true,
      },
    });

    if (!consultant) {
      throw new NotFoundException('Assessor não encontrado');
    }

    const consultantFullName = `${consultant.name} ${consultant.surname}`;

    try {
      // Send the registration email with JWT token in referral parameter
      // This will throw BadRequestException if email is invalid
      const result = await this.sesService.sendRegistrationEmail(
        sendInvitationDto.email,
        consultantId,
        consultantFullName,
      );

      if (!result.success) {
        throw new InternalServerErrorException(
          result.error || 'Falha ao enviar email de convite',
        );
      }

      return {
        success: true,
        message: 'Convite enviado com sucesso',
        email: sendInvitationDto.email,
        messageId: result.messageId,
      };
    } catch (error) {
      // Re-throw BadRequestException from email validation
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log and throw other errors
      throw new InternalServerErrorException(
        'Erro ao enviar convite. Tente novamente mais tarde.',
      );
    }
  }

  /**
   * Update a client, ensuring it belongs to the consultant
   * @param consultantId - The ID of the consultant
   * @param clientId - The ID of the client to update
   * @param updateClientDto - Data to update
   */
  async updateClient(
    consultantId: string,
    clientId: string,
    updateClientDto: UpdateClientDto,
  ) {
    // First, verify the client exists and belongs to this consultant
    const existingClient = await this.prismaService.user.findFirst({
      where: {
        id: clientId,
        consultant_id: consultantId,
        role: 'CUSTOMER',
      },
    });

    if (!existingClient) {
      throw new NotFoundException(
        'Cliente não encontrado ou não pertence a este assessor',
      );
    }

    // Update the client
    const updatedClient = await this.prismaService.user.update({
      where: {
        id: clientId,
      },
      data: updateClientDto,
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        cpf: true,
        rg: true,
        civil_state: true,
        address_id: true,
        consultant_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return updatedClient;
  }

  /**
   * Delete a client, ensuring it belongs to the consultant
   * @param consultantId - The ID of the consultant
   * @param clientId - The ID of the client to delete
   */
  async removeClient(consultantId: string, clientId: string) {
    // First, verify the client exists and belongs to this consultant
    const existingClient = await this.prismaService.user.findFirst({
      where: {
        id: clientId,
        consultant_id: consultantId,
        role: 'CUSTOMER',
      },
    });

    if (!existingClient) {
      throw new NotFoundException(
        'Cliente não encontrado ou não pertence a este assessor',
      );
    }

    // Remove consultant_id from client, but don't delete the user
    await this.prismaService.user.update({
      where: {
        id: clientId,
      },
      data: {
        consultant_id: null,
      },
    });

    return { success: true, message: 'Cliente removido com sucesso' };
  }
}
