import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';
import { GoogleMeetOAuthService } from './google-meet-oauth.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly meetAccessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  private readonly demoMeetingFallbackEnabled: boolean;
  private readonly meetingProvider: 'GOOGLE' | 'JITSI';
  private readonly jitsiBaseUrl: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly googleMeetOAuthService: GoogleMeetOAuthService,
  ) {
    const accessType = this.configService
      .get<string>('GOOGLE_MEET_ACCESS_TYPE', 'OPEN')
      ?.toUpperCase();
    this.meetAccessType =
      accessType === 'TRUSTED' || accessType === 'RESTRICTED'
        ? accessType
        : 'OPEN';
    this.demoMeetingFallbackEnabled =
      this.configService.get<string>(
        'MEETING_DEMO_FALLBACK_ENABLED',
        'false',
      ) === 'true';
    this.meetingProvider =
      this.configService
        .get<string>('MEETING_PROVIDER', 'GOOGLE')
        ?.toUpperCase() === 'JITSI'
        ? 'JITSI'
        : 'GOOGLE';
    this.jitsiBaseUrl = this.configService.get<string>(
      'JITSI_BASE_URL',
      'https://meet.jit.si',
    );
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }

  private buildDemoMeetingLink(processId: string): string {
    const room = `highclassshop-${processId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${Date.now().toString(36)}`;
    return `${this.jitsiBaseUrl.replace(/\/$/, '')}/${room}`;
  }

  /**
   * Cria uma sala Google Meet via Meet REST API (spaces.create) com accessType
   * configurado (OPEN por padrão → cliente externo/anônimo entra sem sala de espera).
   * Retorna o nome do space (ex.: "spaces/abc") e o meetingUri.
   */
  private async createMeetSpace(): Promise<{
    spaceName: string;
    meetingUri: string;
  }> {
    const accessToken = await this.googleMeetOAuthService.getAccessToken();

    const response = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: { accessType: this.meetAccessType },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Meet spaces.create falhou (${response.status}): ${detail}`,
      );
    }

    const data: any = await response.json();
    if (!data?.meetingUri || !data?.name) {
      throw new Error(
        'Meet spaces.create retornou resposta sem meetingUri/name',
      );
    }

    return { spaceName: data.name, meetingUri: data.meetingUri };
  }

  private async getAuthorizedProcess(processId: string, userId: string) {
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        appointment: true,
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            surname: true,
            consultant_id: true,
            consultant: {
              select: { id: true, email: true, name: true, surname: true },
            },
          },
        },
        specialist: {
          select: { id: true, email: true, name: true, surname: true },
        },
        meeting_session: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Processo não encontrado');
    }

    const isClient = process.client_id === userId;
    const isSpecialist = process.specialist_id === userId;
    // Consultor que gerencia o cliente também pode acompanhar a reunião
    const isConsultant = process.client?.consultant_id === userId;

    if (!isClient && !isSpecialist && !isConsultant) {
      throw new ForbiddenException('Sem permissão para acessar esta reunião');
    }

    return { process, isClient, isSpecialist, isConsultant };
  }

  private buildMeetingResponse(meetingSession: {
    id: string;
    process_id: string;
    meet_link: string;
    started_at: Date;
    ended_at?: Date | null;
  }) {
    return {
      id: meetingSession.id,
      process_id: meetingSession.process_id,
      meet_link: meetingSession.meet_link,
      started_at: meetingSession.started_at,
      ended_at: meetingSession.ended_at ?? null,
      is_active: !meetingSession.ended_at,
    };
  }

  private getProductDetails(process: any): string {
    const productMap: Record<string, string> = {
      CAR: 'car',
      BOAT: 'boat',
      AIRCRAFT: 'aircraft',
    };

    const relation = productMap[process.product_type];
    if (!relation || !process[relation]) {
      return 'Produto não especificado';
    }

    const product = process[relation];
    return `${product.marca || ''} ${product.modelo || ''}`.trim() || 'Produto';
  }

  private async advanceProcessAfterConversation(
    processId: string,
    userId: string,
  ): Promise<{
    advanced: boolean;
    previous_status: ProcessStatus;
    status: ProcessStatus;
    requires_product_selection: boolean;
    message: string;
  }> {
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      select: {
        id: true,
        status: true,
        notes: true,
        product_type: true,
        car_id: true,
        boat_id: true,
        aircraft_id: true,
        client: {
          select: { email: true, name: true, surname: true },
        },
        specialist: {
          select: { email: true, name: true, surname: true },
        },
        car: { select: { marca: true, modelo: true } },
        boat: { select: { marca: true, modelo: true } },
        aircraft: { select: { marca: true, modelo: true } },
      },
    });

    if (!process) {
      throw new NotFoundException('Processo não encontrado');
    }

    const hasProduct = Boolean(
      process.product_type &&
        (process.car_id || process.boat_id || process.aircraft_id),
    );

    const previousStatus = process.status as ProcessStatus;

    if (!hasProduct) {
      await this.prismaService.process.update({
        where: { id: processId },
        data: {
          notes: process.notes
            ? `${process.notes}\n\nConversa concluída com cliente (${new Date().toISOString()}). Aguardando seleção de produto.`
            : `Conversa concluída com cliente (${new Date().toISOString()}). Aguardando seleção de produto.`,
        },
      });

      return {
        advanced: false,
        previous_status: previousStatus,
        status: previousStatus,
        requires_product_selection: true,
        message:
          'Conversa marcada como concluída. Selecione um produto para seguir com a negociação.',
      };
    }

    if (process.status !== ProcessStatus.SCHEDULING) {
      return {
        advanced: false,
        previous_status: previousStatus,
        status: previousStatus,
        requires_product_selection: false,
        message: 'Conversa concluída. O processo já está em etapa posterior.',
      };
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      const updatedProcess = await tx.process.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.NEGOTIATION,
          notes: process.notes
            ? `${process.notes}\n\nConversa concluída com cliente (${new Date().toISOString()}). Processo avançado para NEGOTIATION.`
            : `Conversa concluída com cliente (${new Date().toISOString()}). Processo avançado para NEGOTIATION.`,
        },
        select: {
          status: true,
        },
      });

      await tx.processStatusHistory.create({
        data: {
          processId,
          status: ProcessStatus.NEGOTIATION,
          changed_by: userId,
        },
      });

      return updatedProcess;
    });

    setImmediate(() => {
      const recipients = [
        {
          email: process.client.email,
          name: `${process.client.name} ${process.client.surname || ''}`.trim(),
        },
        {
          email: process.specialist.email,
          name: `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
        },
      ].filter((recipient) => Boolean(recipient.email));

      Promise.allSettled(
        recipients.map((recipient) =>
          this.notificationService.sendProcessStatusChangedEmail({
            recipientEmail: recipient.email!,
            recipientName: recipient.name || 'Usuário',
            processId,
            previousStatus: ProcessStatus.SCHEDULING,
            currentStatus: ProcessStatus.NEGOTIATION,
            changedByName:
              `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
            reason: 'Conversa concluída e processo avançado para negociação.',
            productDetails: this.getProductDetails(process),
          }),
        ),
      ).catch((err) => {
        this.logger.error('Notification failed (non-critical)', {
          method: 'advanceProcessAfterConversation',
          processId,
          error: err.message,
        });
      });
    });

    return {
      advanced: true,
      previous_status: previousStatus,
      status: updated.status as ProcessStatus,
      requires_product_selection: false,
      message: 'Conversa concluída. Processo avançado para negociação.',
    };
  }

  async getMeetingByProcess(processId: string, userId: string) {
    const { process } = await this.getAuthorizedProcess(processId, userId);

    return process.meeting_session
      ? this.buildMeetingResponse(process.meeting_session)
      : null;
  }

  async startMeetingForProcess(
    processId: string,
    userId: string,
    isAdvanced?: boolean,
  ) {
    const { process, isSpecialist } = await this.getAuthorizedProcess(
      processId,
      userId,
    );

    if (!isSpecialist) {
      throw new ForbiddenException(
        'Apenas o especialista pode iniciar a reunião',
      );
    }

    const consultant = process.client.consultant;
    const consultantEmail = consultant?.email;
    const consultantName = consultant
      ? `${consultant.name} ${consultant.surname || ''}`.trim()
      : undefined;

    if (
      process.status !== 'SCHEDULING' &&
      process.status !== 'NEGOTIATION' &&
      process.status !== 'PROCESSING_CONTRACT'
    ) {
      throw new BadRequestException(
        'Processo não está em etapa válida para iniciar reunião',
      );
    }

    if (process.meeting_session) {
      return this.buildMeetingResponse(process.meeting_session);
    }

    if (this.meetingProvider === 'JITSI') {
      const jitsiLink = this.buildDemoMeetingLink(process.id);
      const meeting = await this.prismaService.meetingSession.create({
        data: {
          process_id: process.id,
          started_by_id: userId,
          calendar_event_id: `jitsi-${randomUUID()}`,
          meet_link: jitsiLink,
          started_at: new Date(),
        },
      });

      this.logger.log(
        `[meetings] Reunião criada com provedor JITSI para processId=${process.id}`,
      );

      setImmediate(() => {
        const emailData = {
          clientEmail: process.client.email,
          clientName:
            `${process.client.name} ${process.client.surname || ''}`.trim(),
          specialistName:
            `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
          processId: process.id,
          platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
          meetingLink: jitsiLink,
          consultantEmail,
          consultantName,
        };
        const emailMethod = isAdvanced
          ? this.notificationService.sendMeetingAdvancedEmail(emailData)
          : this.notificationService.sendMeetingStartedEmail(emailData);
        emailMethod.catch((err) => {
          this.logger.error('Falha ao enviar e-mail de reunião iniciada', {
            processId: process.id,
            error: err.message,
          });
        });
      });

      return {
        ...this.buildMeetingResponse(meeting),
      };
    }

    const specialistName =
      `${process.specialist.name} ${process.specialist.surname || ''}`.trim();
    const clientName =
      `${process.client.name} ${process.client.surname || ''}`.trim();

    let meetLink: string;
    let spaceName: string;
    try {
      const space = await this.createMeetSpace();
      meetLink = space.meetingUri;
      spaceName = space.spaceName;
    } catch (error) {
      if (this.demoMeetingFallbackEnabled) {
        const demoLink = this.buildDemoMeetingLink(process.id);
        const meeting = await this.prismaService.meetingSession.create({
          data: {
            process_id: process.id,
            started_by_id: userId,
            calendar_event_id: `demo-${randomUUID()}`,
            meet_link: demoLink,
            started_at: new Date(),
          },
        });

        this.logger.warn(
          `[meetings] Fallback DEMO ativado após falha no Google Meet. processId=${process.id}`,
        );

        setImmediate(() => {
          const emailData = {
            clientEmail: process.client.email,
            clientName,
            specialistName,
            processId: process.id,
            platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
            meetingLink: demoLink,
            consultantEmail,
            consultantName,
          };
          const emailMethod = isAdvanced
            ? this.notificationService.sendMeetingAdvancedEmail(emailData)
            : this.notificationService.sendMeetingStartedEmail(emailData);
          emailMethod.catch((err) => {
            this.logger.error('Falha ao enviar e-mail de reunião iniciada', {
              processId: process.id,
              error: err.message,
            });
          });
        });

        return {
          ...this.buildMeetingResponse(meeting),
        };
      }

      this.logger.error('Falha ao criar sala no Google Meet', {
        processId: process.id,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      });
      throw new ServiceUnavailableException(
        'Não foi possível criar a reunião no Google Meet. Verifique a conta conectada nas configurações.',
      );
    }

    const meeting = await this.prismaService.meetingSession.create({
      data: {
        process_id: process.id,
        started_by_id: userId,
        calendar_event_id: spaceName,
        meet_link: meetLink,
        started_at: new Date(),
      },
    });

    setImmediate(() => {
      const emailData = {
        clientEmail: process.client.email,
        clientName,
        specialistName,
        processId: process.id,
        platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
        meetingLink: meetLink,
        consultantEmail,
        consultantName,
      };
      const emailMethod = isAdvanced
        ? this.notificationService.sendMeetingAdvancedEmail(emailData)
        : this.notificationService.sendMeetingStartedEmail(emailData);
      emailMethod.catch((err) => {
        this.logger.error('Falha ao enviar e-mail de reunião iniciada', {
          processId: process.id,
          error: err.message,
        });
      });
    });

    return this.buildMeetingResponse(meeting);
  }

  async endMeetingForProcess(processId: string, userId: string) {
    const { process, isSpecialist } = await this.getAuthorizedProcess(
      processId,
      userId,
    );

    if (!isSpecialist) {
      throw new ForbiddenException(
        'Apenas o especialista pode encerrar a reunião',
      );
    }

    if (!process.meeting_session) {
      throw new NotFoundException('Reunião não encontrada para este processo');
    }

    if (process.meeting_session.ended_at) {
      return {
        meeting: this.buildMeetingResponse(process.meeting_session),
        alreadyEnded: true,
        message: 'Reunião já estava encerrada.',
      };
    }

    const meeting = await this.prismaService.meetingSession.update({
      where: { id: process.meeting_session.id },
      data: {
        ended_at: new Date(),
        ended_by_id: userId,
      },
    });

    return {
      meeting: this.buildMeetingResponse(meeting),
      alreadyEnded: false,
      message: 'Reunião encerrada com sucesso.',
    };
  }

  async markConversationDone(processId: string, userId: string) {
    const endResult = await this.endMeetingForProcess(processId, userId);
    const transition = await this.advanceProcessAfterConversation(
      processId,
      userId,
    );

    return {
      ...endResult,
      processTransition: transition,
    };
  }
}
