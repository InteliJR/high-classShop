import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { CreateConsultantProcessDto } from './dto/create-consultant-process.dto';
import { SesService } from 'src/aws/ses.service';

@Injectable()
export class ConsultantService {
  constructor(
    private prismaService: PrismaService,
    private sesService: SesService,
    private jwtService: JwtService,
  ) {}

  /**
   * List all clients for a specific consultant
   * @param consultantId - The ID of the consultant
   */
  async findAllClients(consultantId: string) {
    const clients = await this.prismaService.user.findMany({
      where: {
        consultant_id: consultantId,
        role: 'CUSTOMER',
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
   * @returns Object with success status, registration link, and optional warning
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

    const referralToken = this.generateReferralToken(
      consultantId,
      sendInvitationDto.email,
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationLink = `${frontendUrl}/register?ref=${referralToken}`;

    try {
      const result = await this.sesService.sendRegistrationEmail(
        sendInvitationDto.email,
        consultantId,
        consultantFullName,
      );

      if (!result.success) {
        return {
          success: true,
          message: 'Link de convite gerado com sucesso',
          email: sendInvitationDto.email,
          registrationLink,
          warning:
            'O link foi gerado, mas não conseguimos enviar por email. Compartilhe-o manualmente com ' +
            sendInvitationDto.email,
        };
      }

      return {
        success: true,
        message: 'Convite enviado com sucesso',
        email: sendInvitationDto.email,
        registrationLink,
        messageId: result.messageId,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: true,
        message: 'Link de convite gerado com sucesso',
        email: sendInvitationDto.email,
        registrationLink,
        warning:
          'O link foi gerado, mas não conseguimos enviar por email. Compartilhe-o manualmente com ' +
          sendInvitationDto.email,
      };
    }
  }

  /**
   * Generate a JWT token for referral link
   * @param consultantId - ID of the consultant
   * @param email - Email of the potential client
   * @returns JWT token
   */
  private generateReferralToken(consultantId: string, email: string): string {
    const payload = {
      consultantId,
      email,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
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
   * Create a process on behalf of a client
   */
  async createProcessForClient(
    consultantId: string,
    dto: CreateConsultantProcessDto,
  ) {
    const client = await this.prismaService.user.findFirst({
      where: {
        id: dto.client_id,
        consultant_id: consultantId,
        role: 'CUSTOMER',
      },
    });

    if (!client) {
      throw new ForbiddenException(
        'Cliente não encontrado ou não pertence a este consultor',
      );
    }

    const specialist = await this.prismaService.user.findFirst({
      where: { id: dto.specialist_id, role: 'SPECIALIST' },
    });

    if (!specialist) {
      throw new NotFoundException('Especialista não encontrado');
    }

    const productFieldMap = {
      CAR: 'car_id',
      BOAT: 'boat_id',
      AIRCRAFT: 'aircraft_id',
    } as const;
    const productField = dto.product_id
      ? productFieldMap[dto.product_type]
      : undefined;

    const activeStatuses = [
      'SCHEDULING',
      'NEGOTIATION',
      'PROCESSING_CONTRACT',
      'DOCUMENTATION',
    ] as const;

    if (productField && dto.product_id) {
      const existing = await this.prismaService.process.findFirst({
        where: {
          client_id: dto.client_id,
          specialist_id: dto.specialist_id,
          [productField]: dto.product_id,
        },
      });
      if (existing) {
        throw new ConflictException(
          'Já existe processo para este cliente com este produto.',
        );
      }
    } else {
      const activeConsultancy = await this.prismaService.process.findFirst({
        where: {
          client_id: dto.client_id,
          specialist_id: dto.specialist_id,
          product_type: null,
          status: { in: [...activeStatuses] as any },
        },
      });
      if (activeConsultancy) {
        throw new ConflictException(
          'Já existe consultoria ativa entre este cliente e este especialista.',
        );
      }
    }

    const pendingExpiresAt = new Date();
    pendingExpiresAt.setDate(pendingExpiresAt.getDate() + 7);

    const isConsultancy = !productField || !dto.product_id;

    const [, process] = await this.prismaService.$transaction(async (tx) => {
      const appointmentData: any = {
        client_id: dto.client_id,
        specialist_id: dto.specialist_id,
        appointment_datetime: null,
        status: 'PENDING',
        notes: isConsultancy
          ? `Consultoria criada pelo consultor em nome do cliente (${new Date().toISOString()})`
          : `Processo criado pelo consultor em nome do cliente (${new Date().toISOString()})`,
        user_clicked_at: new Date(),
        pending_expires_at: pendingExpiresAt,
      };
      if (!isConsultancy) {
        appointmentData.product_type = dto.product_type;
        appointmentData.product_id = dto.product_id;
      }

      const createdAppointment = await tx.appointment.create({
        data: appointmentData,
      });

      const processData: any = {
        client_id: dto.client_id,
        specialist_id: dto.specialist_id,
        appointment_id: createdAppointment.id,
        product_type: isConsultancy ? null : dto.product_type,
        status: 'SCHEDULING',
        notes: isConsultancy
          ? `Consultoria iniciada pelo consultor (${new Date().toISOString()})`
          : `Processo iniciado pelo consultor (${new Date().toISOString()})`,
      };
      if (!isConsultancy && productField && dto.product_id) {
        processData[productField] = dto.product_id;
      }

      const createdProcess = await tx.process.create({ data: processData });

      await tx.processStatusHistory.create({
        data: {
          processId: createdProcess.id,
          status: 'SCHEDULING',
          changed_by: consultantId,
          changed_at: new Date(),
        },
      });

      return [createdAppointment, createdProcess];
    });

    return process;
  }

  /**
   * Get all processes for a client, validating consultant ownership
   */
  async getClientProcesses(consultantId: string, clientId: string) {
    const client = await this.prismaService.user.findFirst({
      where: { id: clientId, consultant_id: consultantId, role: 'CUSTOMER' },
    });

    if (!client) {
      throw new ForbiddenException(
        'Cliente não encontrado ou não pertence a este consultor',
      );
    }

    return this.prismaService.process.findMany({
      where: { client_id: clientId },
      include: {
        specialist: {
          select: { id: true, name: true, surname: true, speciality: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get all processes across all clients of the consultant, with optional filters
   */
  async getAllProcesses(
    consultantId: string,
    filters: { status?: string; clientId?: string } = {},
  ) {
    const clients = await this.prismaService.user.findMany({
      where: { consultant_id: consultantId, role: 'CUSTOMER' },
      select: { id: true, name: true, surname: true },
    });

    const clientIds = clients.map((c) => c.id);
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const where: any = { client_id: { in: clientIds } };
    if (filters.status) where.status = filters.status;
    if (filters.clientId) {
      if (!clientIds.includes(filters.clientId)) return [];
      where.client_id = filters.clientId;
    }

    const processes = await this.prismaService.process.findMany({
      where,
      include: {
        specialist: {
          select: { id: true, name: true, surname: true, speciality: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return processes.map((p) => ({
      ...p,
      client: clientMap.get(p.client_id) ?? null,
    }));
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
