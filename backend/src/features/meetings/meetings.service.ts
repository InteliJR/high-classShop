import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';
import { GoogleMeetOAuthService } from './google-meet-oauth.service';
import { buildNegotiationSnapshotUpdate } from 'src/features/processes/negotiation-snapshot';
import { lockNegotiationProductMoney } from 'src/features/products/product-monetary-lock';
import { acquireSpecialistScheduleLock } from 'src/features/appointments/appointment-schedule-lock';
import {
  buildReadyMeetingClaim,
  isMeetingInitializationClaim,
  isStaleMeetingInitializationClaim,
  MEETING_INITIALIZATION_PREFIX,
  parseReadyMeetingClaim,
} from './meeting-initialization-claim';
import { ActorContext } from 'src/shared/actor-context/actor-context.service';
import { DelegatedActionAuditService } from 'src/shared/actor-context/delegated-action-audit.service';

const MEETING_PROVIDER_TIMEOUT_MS = 10_000;

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
    @Optional()
    private readonly delegatedAudit?: DelegatedActionAuditService,
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
    const room = `bmf-lux-brokerage-${processId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${Date.now().toString(36)}`;
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
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `Tempo limite de ${MEETING_PROVIDER_TIMEOUT_MS}ms excedido ao criar sala`,
          ),
        );
      }, MEETING_PROVIDER_TIMEOUT_MS);
    });
    const beforeDeadline = <T>(operation: Promise<T>): Promise<T> =>
      Promise.race([operation, deadline]);

    try {
      const accessToken = await beforeDeadline(
        this.googleMeetOAuthService.getAccessToken(),
      );

      const response = await beforeDeadline(
        fetch('https://meet.googleapis.com/v2/spaces', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: { accessType: this.meetAccessType },
          }),
          signal: controller.signal,
        }),
      );

      if (!response.ok) {
        const detail = await beforeDeadline(response.text());
        throw new Error(
          `Meet spaces.create falhou (${response.status}): ${detail}`,
        );
      }

      const data: any = await beforeDeadline(response.json());
      if (!data?.meetingUri || !data?.name) {
        throw new Error(
          'Meet spaces.create retornou resposta sem meetingUri/name',
        );
      }

      return { spaceName: data.name, meetingUri: data.meetingUri };
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private assertMeetingCanStart(process: any, userId: string): void {
    if (process.specialist_id !== userId) {
      throw new ForbiddenException(
        'Apenas o especialista pode iniciar a reunião',
      );
    }
    if (
      !process.appointment_id ||
      !process.appointment ||
      process.appointment.id !== process.appointment_id ||
      process.appointment.client_id !== process.client_id ||
      process.appointment.specialist_id !== process.specialist_id
    ) {
      throw new BadRequestException(
        'Agendamento não corresponde aos participantes do processo',
      );
    }
    if (
      process.appointment.status !== StatusAgendamento.SCHEDULED &&
      process.appointment.status !== StatusAgendamento.COMPLETED
    ) {
      throw new BadRequestException(
        'Agendamento não está confirmado para iniciar reunião',
      );
    }
    if (
      process.status !== ProcessStatus.SCHEDULING &&
      process.status !== ProcessStatus.NEGOTIATION &&
      process.status !== ProcessStatus.PROCESSING_CONTRACT
    ) {
      throw new BadRequestException(
        'Processo não está em etapa válida para iniciar reunião',
      );
    }
  }

  private async removeInitializationClaim(
    processId: string,
    specialistId: string,
    calendarEventId: string,
  ): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, specialistId);
      await tx.meetingSession.deleteMany({
        where: {
          process_id: processId,
          calendar_event_id: calendarEventId,
        },
      });
    });
  }

  private async getAuthorizedProcess(
    processId: string,
    userId: string,
    context?: ActorContext,
  ) {
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
    const representedSpecialistId = context?.specialistId ?? userId;
    const isSpecialist = process.specialist_id === representedSpecialistId;
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
    context?: ActorContext,
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
        negotiation_currency: true,
        negotiation_product_value: true,
        client: {
          select: { email: true, name: true, surname: true },
        },
        specialist: {
          select: { email: true, name: true, surname: true },
        },
        car: {
          select: { marca: true, modelo: true },
        },
        boat: {
          select: { marca: true, modelo: true },
        },
        aircraft: {
          select: { marca: true, modelo: true },
        },
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

    const transition = await this.prismaService.$transaction(async (tx) => {
      await lockNegotiationProductMoney(tx, process);
      const processForTransition = await tx.process.findUniqueOrThrow({
        where: { id: process.id },
        include: {
          car: { select: { valor: true, currency: true } },
          boat: { select: { valor: true, currency: true } },
          aircraft: { select: { valor: true, currency: true } },
        },
      });
      if (processForTransition.status !== ProcessStatus.SCHEDULING) {
        return {
          advanced: false,
          status: processForTransition.status as ProcessStatus,
        };
      }
      const snapshotData = buildNegotiationSnapshotUpdate(processForTransition);
      const claim = await tx.process.updateMany({
        where: { id: processId, status: ProcessStatus.SCHEDULING },
        data: {
          status: ProcessStatus.NEGOTIATION,
          notes: processForTransition.notes
            ? `${processForTransition.notes}\n\nConversa concluída com cliente (${new Date().toISOString()}). Processo avançado para NEGOTIATION.`
            : `Conversa concluída com cliente (${new Date().toISOString()}). Processo avançado para NEGOTIATION.`,
          updated_at: new Date(),
          ...snapshotData,
        },
      });

      if (claim.count !== 1) {
        const latestProcess = await tx.process.findUniqueOrThrow({
          where: { id: processId },
          select: { status: true },
        });
        return {
          advanced: false,
          status: latestProcess.status as ProcessStatus,
        };
      }

      await tx.processStatusHistory.create({
        data: {
          processId,
          status: ProcessStatus.NEGOTIATION,
          changed_by: userId,
        },
      });

      if (context && this.delegatedAudit) {
        await this.delegatedAudit.record(
          {
            context,
            action: 'MEETING_CONVERSATION_DONE',
            resourceType: 'PROCESS',
            resourceId: processId,
            metadata: {
              from: ProcessStatus.SCHEDULING,
              to: ProcessStatus.NEGOTIATION,
            },
          },
          tx,
        );
      }

      return { advanced: true, status: ProcessStatus.NEGOTIATION };
    });

    if (!transition.advanced) {
      return {
        advanced: false,
        previous_status: previousStatus,
        status: transition.status,
        requires_product_selection: false,
        message: 'Conversa concluída. O processo já está em etapa posterior.',
      };
    }

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
              context?.delegated && context.actor
                ? `${context.actor.name} ${context.actor.surname}`.trim()
                : `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
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
      status: transition.status,
      requires_product_selection: false,
      message: 'Conversa concluída. Processo avançado para negociação.',
    };
  }

  async getMeetingByProcess(
    processId: string,
    userId: string,
    context?: ActorContext,
  ) {
    const { process } = await this.getAuthorizedProcess(
      processId,
      userId,
      context,
    );

    return process.meeting_session &&
      !isMeetingInitializationClaim(process.meeting_session) &&
      !parseReadyMeetingClaim(process.meeting_session)
      ? this.buildMeetingResponse(process.meeting_session)
      : null;
  }

  async startMeetingForProcess(
    processId: string,
    userId: string,
    isAdvanced?: boolean,
    context?: ActorContext,
  ) {
    const { isSpecialist } = await this.getAuthorizedProcess(
      processId,
      userId,
      context,
    );
    const representedSpecialistId = context?.specialistId ?? userId;

    if (!isSpecialist) {
      throw new ForbiddenException(
        'Apenas o especialista pode iniciar a reunião',
      );
    }

    const reservation = await this.prismaService.$transaction(
      async (tx) => {
        const candidate = await tx.process.findUnique({
          where: { id: processId },
          select: { id: true, specialist_id: true },
        });
        if (!candidate) {
          throw new NotFoundException('Processo não encontrado');
        }
        if (candidate.specialist_id !== representedSpecialistId) {
          throw new ForbiddenException(
            'Apenas o especialista pode iniciar a reunião',
          );
        }

        await acquireSpecialistScheduleLock(tx, candidate.specialist_id);

        const process = await tx.process.findUnique({
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
        this.assertMeetingCanStart(process, representedSpecialistId);
        if (process.meeting_session) {
          const ready = parseReadyMeetingClaim(process.meeting_session);
          if (ready) {
            return {
              process,
              meeting: process.meeting_session,
              ready,
              created: false,
              provider: ready.provider,
            };
          }
          if (isMeetingInitializationClaim(process.meeting_session)) {
            if (!isStaleMeetingInitializationClaim(process.meeting_session)) {
              throw new ConflictException(
                'A reunião já está sendo iniciada. Tente novamente em instantes.',
              );
            }
            await tx.meetingSession.deleteMany({
              where: {
                id: process.meeting_session.id,
                calendar_event_id: process.meeting_session.calendar_event_id,
              },
            });
          } else {
            return {
              process,
              meeting: process.meeting_session,
              ready: null,
              created: false,
              provider: 'EXISTING' as const,
            };
          }
        }

        const claimId = randomUUID();
        const claimCalendarEventId = `${MEETING_INITIALIZATION_PREFIX}${claimId}`;
        const meeting = await tx.meetingSession.create({
          data: {
            process_id: process.id,
            started_by_id: userId,
            calendar_event_id: claimCalendarEventId,
            meet_link: '',
            started_at: new Date(),
          },
        });

        return {
          process,
          meeting,
          claimId,
          claimCalendarEventId,
          ready: null,
          created: true,
          provider: null,
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if (!reservation.created && !reservation.ready) {
      return this.buildMeetingResponse(reservation.meeting);
    }

    let ready = reservation.ready;
    if (!ready) {
      const claimId = reservation.claimId;
      const claimCalendarEventId = reservation.claimCalendarEventId;
      if (!claimId || !claimCalendarEventId) {
        throw new ConflictException('Reserva de reunião inválida');
      }
      let meetLink: string;
      let calendarEventId: string;
      let provider: 'JITSI' | 'GOOGLE' | 'DEMO';
      if (this.meetingProvider === 'JITSI') {
        meetLink = this.buildDemoMeetingLink(reservation.process.id);
        calendarEventId = `jitsi-${randomUUID()}`;
        provider = 'JITSI';
      } else {
        try {
          const space = await this.createMeetSpace();
          meetLink = space.meetingUri;
          calendarEventId = space.spaceName;
          provider = 'GOOGLE';
        } catch (error) {
          if (!this.demoMeetingFallbackEnabled) {
            try {
              await this.removeInitializationClaim(
                processId,
                representedSpecialistId,
                claimCalendarEventId,
              );
            } catch (cleanupError) {
              this.logger.error('Falha ao liberar reserva de reunião', {
                processId,
                error:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : 'erro desconhecido',
              });
            }
            this.logger.error('Falha ao criar sala no Google Meet', {
              processId: reservation.process.id,
              error:
                error instanceof Error ? error.message : 'erro desconhecido',
            });
            throw new ServiceUnavailableException(
              'Não foi possível criar a reunião no Google Meet. Verifique a conta conectada nas configurações.',
            );
          }

          meetLink = this.buildDemoMeetingLink(reservation.process.id);
          calendarEventId = `demo-${randomUUID()}`;
          provider = 'DEMO';
        }
      }

      const readyCalendarEventId = buildReadyMeetingClaim(
        claimId,
        provider,
        calendarEventId,
      );
      const checkpoint = await this.prismaService.meetingSession.updateMany({
        where: {
          id: reservation.meeting.id,
          process_id: processId,
          calendar_event_id: claimCalendarEventId,
          meet_link: '',
        },
        data: {
          calendar_event_id: readyCalendarEventId,
          meet_link: meetLink,
        },
      });
      if (checkpoint.count !== 1) {
        throw new ConflictException(
          'A reserva da reunião mudou durante a criação. Tente novamente.',
        );
      }
      ready = { claimId, provider, calendarEventId };
      reservation.meeting.calendar_event_id = readyCalendarEventId;
      reservation.meeting.meet_link = meetLink;
    }
    if (!ready) {
      throw new ConflictException('Reserva de reunião inválida');
    }
    const readyClaim = ready;

    const finalized = await this.prismaService.$transaction(
      async (tx) => {
        const candidate = await tx.process.findUnique({
          where: { id: processId },
          select: { id: true, specialist_id: true },
        });
        if (!candidate) {
          throw new NotFoundException('Processo não encontrado');
        }
        if (candidate.specialist_id !== representedSpecialistId) {
          throw new ForbiddenException(
            'Apenas o especialista pode iniciar a reunião',
          );
        }
        await acquireSpecialistScheduleLock(tx, candidate.specialist_id);
        const process = await tx.process.findUnique({
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
        try {
          this.assertMeetingCanStart(process, representedSpecialistId);
        } catch (error) {
          const invalidReady = parseReadyMeetingClaim(process.meeting_session);
          if (invalidReady?.claimId === readyClaim.claimId) {
            await tx.meetingSession.deleteMany({
              where: {
                id: process.meeting_session!.id,
                calendar_event_id: process.meeting_session!.calendar_event_id,
              },
            });
          }
          return { failure: error };
        }

        const currentMeeting = process.meeting_session;
        const currentReady = parseReadyMeetingClaim(currentMeeting);
        if (!currentReady || currentReady.claimId !== readyClaim.claimId) {
          if (
            currentMeeting &&
            !isMeetingInitializationClaim(currentMeeting) &&
            !currentReady
          ) {
            return {
              process,
              meeting: currentMeeting,
              created: false,
              provider: 'EXISTING' as const,
            };
          }
          throw new ConflictException(
            'A reserva da reunião mudou durante a finalização. Tente novamente.',
          );
        }
        if (!currentMeeting) {
          throw new ConflictException(
            'A reserva da reunião não existe mais. Tente novamente.',
          );
        }

        const update = await tx.meetingSession.updateMany({
          where: {
            id: currentMeeting.id,
            calendar_event_id: currentMeeting.calendar_event_id,
          },
          data: { calendar_event_id: readyClaim.calendarEventId },
        });
        if (update.count !== 1) {
          const current = await tx.meetingSession.findUnique({
            where: { process_id: processId },
          });
          if (current && !parseReadyMeetingClaim(current)) {
            return {
              process,
              meeting: current,
              created: false,
              provider: 'EXISTING' as const,
            };
          }
          throw new ConflictException(
            'A reunião mudou durante a finalização. Tente novamente.',
          );
        }

        if (context && this.delegatedAudit) {
          await this.delegatedAudit.record(
            {
              context,
              action: 'MEETING_START',
              resourceType: 'MEETING',
              resourceId: currentMeeting.id,
              metadata: { processId },
            },
            tx,
          );
        }

        return {
          process,
          meeting: {
            ...currentMeeting,
            calendar_event_id: readyClaim.calendarEventId,
          },
          created: true,
          provider: readyClaim.provider,
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if ('failure' in finalized) {
      throw finalized.failure;
    }

    if (!finalized.created) {
      return this.buildMeetingResponse(finalized.meeting);
    }

    const { process, meeting, provider } = finalized;
    if (provider === 'JITSI') {
      this.logger.log(
        `[meetings] Reunião criada com provedor JITSI para processId=${process.id}`,
      );
    } else if (provider === 'DEMO') {
      this.logger.warn(
        `[meetings] Fallback DEMO ativado após falha no Google Meet. processId=${process.id}`,
      );
    }

    const consultant = process.client.consultant;
    const consultantEmail = consultant?.email;
    const consultantName = consultant
      ? `${consultant.name} ${consultant.surname || ''}`.trim()
      : undefined;
    const specialistName =
      `${process.specialist.name} ${process.specialist.surname || ''}`.trim();
    const clientName =
      `${process.client.name} ${process.client.surname || ''}`.trim();

    setImmediate(() => {
      const emailData = {
        clientEmail: process.client.email,
        clientName,
        specialistName,
        processId: process.id,
        platformMeetingUrl: `${this.frontendUrl}/processes/${process.id}/meeting`,
        meetingLink: meeting.meet_link,
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

  async endMeetingForProcess(
    processId: string,
    userId: string,
    context?: ActorContext,
  ) {
    const { process, isSpecialist } = await this.getAuthorizedProcess(
      processId,
      userId,
      context,
    );

    if (!isSpecialist) {
      throw new ForbiddenException(
        'Apenas o especialista pode encerrar a reunião',
      );
    }

    if (!process.meeting_session) {
      throw new NotFoundException('Reunião não encontrada para este processo');
    }

    if (
      isMeetingInitializationClaim(process.meeting_session) ||
      parseReadyMeetingClaim(process.meeting_session)
    ) {
      throw new ConflictException(
        'A reunião ainda está sendo iniciada. Tente novamente em instantes.',
      );
    }

    if (process.meeting_session.ended_at) {
      return {
        meeting: this.buildMeetingResponse(process.meeting_session),
        alreadyEnded: true,
        message: 'Reunião já estava encerrada.',
      };
    }

    const meetingId = process.meeting_session.id;
    const endClaim = await this.prismaService.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, process.specialist_id);
      const endedAt = new Date();
      const claim = await tx.meetingSession.updateMany({
        where: { id: meetingId, ended_at: null },
        data: { ended_at: endedAt, ended_by_id: userId },
      });
      const meeting = await tx.meetingSession.findUnique({
        where: { id: meetingId },
      });
      if (!meeting) {
        throw new NotFoundException('Reunião não encontrada para este processo');
      }
      if (claim.count === 1 && context && this.delegatedAudit) {
        await this.delegatedAudit.record(
          {
            context,
            action: 'MEETING_END',
            resourceType: 'MEETING',
            resourceId: meeting.id,
            metadata: { processId },
          },
          tx,
        );
      }
      return { meeting, claimed: claim.count === 1 };
    });

    return {
      meeting: this.buildMeetingResponse(endClaim.meeting),
      alreadyEnded: !endClaim.claimed,
      message: endClaim.claimed
        ? 'Reunião encerrada com sucesso.'
        : 'Reunião já estava encerrada.',
    };
  }

  async markConversationDone(
    processId: string,
    userId: string,
    context?: ActorContext,
  ) {
    const endResult = await this.endMeetingForProcess(
      processId,
      userId,
      context,
    );
    const transition = await this.advanceProcessAfterConversation(
      processId,
      userId,
      context,
    );

    return {
      ...endResult,
      processTransition: transition,
    };
  }
}
