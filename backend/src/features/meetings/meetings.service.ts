import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { GaxiosError } from 'gaxios';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly calendarId: string;
  private readonly timezone: string;
  private readonly serviceAccountEmail?: string;
  private readonly serviceAccountPrivateKey?: string;
  private readonly meetPollingAttempts = 5;
  private readonly meetPollingIntervalMs = 1000;
  private readonly demoMeetingFallbackEnabled: boolean;
  private readonly meetingProvider: 'GOOGLE' | 'JITSI';
  private readonly jitsiBaseUrl: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    this.calendarId = this.configService.get<string>(
      'GOOGLE_MEET_CALENDAR_ID',
      'primary',
    );
    this.timezone = this.configService.get<string>(
      'GOOGLE_MEET_TIMEZONE',
      'America/Sao_Paulo',
    );
    this.serviceAccountEmail = this.configService.get<string>(
      'GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL',
    );

    const privateKey = this.configService.get<string>(
      'GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY',
    );

    this.serviceAccountPrivateKey = privateKey?.replace(/\\n/g, '\n');
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

  private getCalendarClient() {
    if (!this.serviceAccountEmail || !this.serviceAccountPrivateKey) {
      throw new ServiceUnavailableException(
        'Integração de reunião não configurada no servidor',
      );
    }

    const auth = new google.auth.JWT({
      email: this.serviceAccountEmail,
      key: this.serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
  }

  private isInvalidConferenceTypeError(error: unknown): boolean {
    if (!(error instanceof GaxiosError)) {
      return false;
    }

    const message = error.response?.data?.error?.message || error.message || '';

    return (
      typeof message === 'string' &&
      message.toLowerCase().includes('invalid conference type value')
    );
  }

  private async createCalendarEventWithMeet(
    calendar: ReturnType<typeof google.calendar>,
    processId: string,
    specialistName: string,
    clientName: string,
    start: Date,
    end: Date,
  ) {
    const baseRequestBody = {
      summary: `Reunião High-class Shop - Processo ${processId}`,
      description: `Reunião entre especialista ${specialistName} e cliente ${clientName}.`,
      start: {
        dateTime: start.toISOString(),
        timeZone: this.timezone,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: this.timezone,
      },
    };

    try {
      return await calendar.events.insert({
        calendarId: this.calendarId,
        conferenceDataVersion: 1,
        requestBody: {
          ...baseRequestBody,
          conferenceData: {
            createRequest: {
              conferenceSolutionKey: { type: 'hangoutsMeet' },
              requestId: randomUUID(),
            },
          },
        },
      });
    } catch (error) {
      if (!this.isInvalidConferenceTypeError(error)) {
        throw error;
      }

      this.logger.warn(
        `[meetings] Calendar rejeitou conferenceSolutionKey.type=hangoutsMeet para processo ${processId}. Tentando fallback sem conferenceSolutionKey.`,
      );

      return calendar.events.insert({
        calendarId: this.calendarId,
        conferenceDataVersion: 1,
        requestBody: {
          ...baseRequestBody,
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
            },
          },
        },
      });
    }
  }

  private extractMeetLinkFromEvent(event: any): string | null {
    return (
      event?.hangoutLink ||
      event?.conferenceData?.entryPoints?.find(
        (entry: any) => entry.entryPointType === 'video',
      )?.uri ||
      null
    );
  }

  private async waitForMeetLink(
    calendar: ReturnType<typeof google.calendar>,
    eventId: string,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= this.meetPollingAttempts; attempt++) {
      const getEvent: any = await calendar.events.get({
        calendarId: this.calendarId,
        eventId,
      });

      const meetLink = this.extractMeetLinkFromEvent(getEvent.data);
      if (meetLink) {
        return meetLink;
      }

      const conferenceStatus =
        getEvent.data.conferenceData?.createRequest?.status?.statusCode;

      if (conferenceStatus === 'failure') {
        this.logger.error(
          `[meetings] Falha definitiva ao gerar conferência para evento ${eventId}.`,
        );
        return null;
      }

      if (attempt < this.meetPollingAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.meetPollingIntervalMs),
        );
      }
    }

    return null;
  }

  private async getAuthorizedProcess(processId: string, userId: string) {
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        appointment: true,
        client: {
          select: { id: true, email: true, name: true, surname: true },
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

    if (!isClient && !isSpecialist) {
      throw new ForbiddenException('Sem permissão para acessar esta reunião');
    }

    return { process, isClient, isSpecialist };
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

  async startMeetingForProcess(processId: string, userId: string) {
    const { process, isSpecialist } = await this.getAuthorizedProcess(
      processId,
      userId,
    );

    if (!isSpecialist) {
      throw new ForbiddenException(
        'Apenas o especialista pode iniciar a reunião',
      );
    }

    if (
      process.status !== 'SCHEDULING' &&
      process.status !== 'NEGOTIATION' &&
      process.status !== 'PROCESSING_CONTRACT'
    ) {
      throw new BadRequestException(
        'Processo não está em etapa válida para iniciar reunião',
      );
    }

    if (!process.appointment) {
      throw new BadRequestException(
        'Este processo não possui agendamento confirmado',
      );
    }

    if (
      process.appointment.status !== StatusAgendamento.SCHEDULED &&
      process.appointment.status !== StatusAgendamento.COMPLETED
    ) {
      throw new BadRequestException(
        'O agendamento ainda não foi confirmado pelo especialista',
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
        this.notificationService
          .sendMeetingStartedEmail({
            clientEmail: process.client.email,
            clientName:
              `${process.client.name} ${process.client.surname || ''}`.trim(),
            specialistName:
              `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
            processId: process.id,
            platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
            meetingLink: jitsiLink,
          })
          .catch((err) => {
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

    const calendar = this.getCalendarClient();
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);

    const specialistName =
      `${process.specialist.name} ${process.specialist.surname || ''}`.trim();
    const clientName =
      `${process.client.name} ${process.client.surname || ''}`.trim();

    let event;
    try {
      event = await this.createCalendarEventWithMeet(
        calendar,
        process.id,
        specialistName,
        clientName,
        now,
        end,
      );
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
          `[meetings] Fallback DEMO ativado após falha no Google Calendar. processId=${process.id}`,
        );

        setImmediate(() => {
          this.notificationService
            .sendMeetingStartedEmail({
              clientEmail: process.client.email,
              clientName:
                `${process.client.name} ${process.client.surname || ''}`.trim(),
              specialistName:
                `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
              processId: process.id,
              platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
              meetingLink: demoLink,
            })
            .catch((err) => {
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

      this.logger.error('Falha ao criar evento no Google Calendar', {
        processId: process.id,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      });
      throw new ServiceUnavailableException(
        'Não foi possível criar a reunião no provedor configurado. Verifique a configuração da plataforma.',
      );
    }

    if (!event.data.id) {
      this.logger.error('Google Calendar retornou evento sem ID', {
        processId,
      });
      throw new ServiceUnavailableException(
        'Não foi possível criar o evento de reunião automaticamente.',
      );
    }

    let meetLink = this.extractMeetLinkFromEvent(event.data);

    if (!meetLink) {
      this.logger.warn(
        `[meetings] Evento criado sem link imediato. Aguardando geração assíncrona do Meet para processId=${processId}.`,
      );

      meetLink = await this.waitForMeetLink(calendar, event.data.id);
    }

    if (!meetLink) {
      if (this.demoMeetingFallbackEnabled) {
        meetLink = this.buildDemoMeetingLink(process.id);
        this.logger.warn(
          `[meetings] Fallback DEMO ativado: evento sem link do Meet. processId=${process.id}, eventId=${event.data.id}`,
        );
      }
    }

    if (!meetLink) {
      this.logger.error('Google Calendar retornou evento sem link de reunião', {
        processId,
        eventId: event.data.id,
      });
      throw new ServiceUnavailableException(
        'O provedor criou o evento, mas não gerou link de reunião para esta configuração.',
      );
    }

    const meeting = await this.prismaService.meetingSession.create({
      data: {
        process_id: process.id,
        started_by_id: userId,
        calendar_event_id: event.data.id,
        meet_link: meetLink,
        started_at: new Date(),
      },
    });

    setImmediate(() => {
      this.notificationService
        .sendMeetingStartedEmail({
          clientEmail: process.client.email,
          clientName,
          specialistName,
          processId: process.id,
          platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
          meetingLink: meetLink,
        })
        .catch((err) => {
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
