import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  Prisma,
  ProviderStatus,
  StatusAgendamento,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { acquireSpecialistScheduleLock } from '../appointments/appointment-schedule-lock';
import { isStaleMeetingInitializationClaim } from '../meetings/meeting-initialization-claim';

const TERMINAL_ENVELOPES = new Set<ProviderStatus>([
  ProviderStatus.COMPLETED,
  ProviderStatus.DECLINED,
  ProviderStatus.VOIDED,
  ProviderStatus.TIMEDOUT,
  ProviderStatus.ERROR,
]);

@Injectable()
export class AdminProcessRemovalService {
  constructor(private readonly prisma: PrismaService) {}

  async remove(processId: string, actorId: string, reason: string) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Informe o motivo da exclusão.');
    }

    const candidate = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { specialist_id: true },
    });
    if (!candidate) throw new NotFoundException('Processo não encontrado.');

    return this.prisma.$transaction(
      async (tx) => {
        // A ordem de locks acompanha as transições de agendamento: agenda,
        // depois processo. O contrato e as propostas têm locks próprios.
        await acquireSpecialistScheduleLock(tx, candidate.specialist_id);
        for (const key of [
          `contract-process:${processId}`,
          `proposal-process:${processId}`,
        ]) {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked
          `;
        }

        const process = await tx.process.findUnique({
          where: { id: processId },
          include: {
            appointment: true,
            meeting_session: true,
            contracts: {
              select: { provider_id: true, provider_status: true },
            },
          },
        });
        if (!process) throw new NotFoundException('Processo não encontrado.');
        if (process.removed_at) {
          throw new ConflictException('Este processo já foi excluído.');
        }
        if (process.specialist_id !== candidate.specialist_id) {
          throw new ConflictException(
            'O especialista do processo mudou. Recarregue a página.',
          );
        }
        if (
          Boolean(process.appointment) !== Boolean(process.appointment_id) ||
          (process.appointment &&
            (process.appointment.id !== process.appointment_id ||
              process.appointment.client_id !== process.client_id ||
              process.appointment.specialist_id !== process.specialist_id))
        ) {
          throw new ConflictException(
            'Agendamento não corresponde aos participantes do processo.',
          );
        }
        if (process.meeting_session && !process.meeting_session.ended_at) {
          if (isStaleMeetingInitializationClaim(process.meeting_session)) {
            const cleanup = await tx.meetingSession.deleteMany({
              where: {
                id: process.meeting_session.id,
                calendar_event_id: process.meeting_session.calendar_event_id,
              },
            });
            if (cleanup.count !== 1) {
              throw new ConflictException(
                'A inicialização da reunião mudou. Recarregue a página.',
              );
            }
          } else {
            throw new ConflictException(
              'Encerre a reunião antes de excluir o processo.',
            );
          }
        }
        if (
          process.contracts.some(
            (contract) =>
              contract.provider_id &&
              !TERMINAL_ENVELOPES.has(
                contract.provider_status as ProviderStatus,
              ),
          )
        ) {
          throw new ConflictException(
            'O contrato possui um envelope DocuSign ativo. Anule e reconcilie o envelope antes de excluir o processo.',
          );
        }

        const appointment = process.appointment;
        const hasOpenAppointment =
          appointment?.status === StatusAgendamento.PENDING ||
          appointment?.status === StatusAgendamento.SCHEDULED;
        if (
          hasOpenAppointment &&
          (appointment?.calendly_event_uri ||
            appointment?.calendly_invitee_uri ||
            (appointment?.scheduling_method ===
              AppointmentSchedulingMethod.CALENDLY &&
              appointment.status === StatusAgendamento.SCHEDULED))
        ) {
          throw new ConflictException(
            'Cancele o evento no Calendly e aguarde a sincronização antes de excluir o processo.',
          );
        }

        const removedAt = new Date();
        const claim = await tx.process.updateMany({
          where: {
            id: processId,
            removed_at: null,
            updated_at: process.updated_at,
          },
          data: {
            removed_at: removedAt,
            removed_by: actorId,
            removal_reason: normalizedReason,
            updated_at: removedAt,
          },
        });
        if (claim.count !== 1) {
          throw new ConflictException(
            'O processo mudou. Recarregue a página e tente novamente.',
          );
        }
        if (hasOpenAppointment && appointment) {
          const cancellation = await tx.appointment.updateMany({
            where: {
              id: appointment.id,
              status: {
                in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
              },
              updated_at: appointment.updated_at,
            },
            data: {
              status: StatusAgendamento.CANCELLED,
              pending_expires_at: null,
            },
          });
          if (cancellation.count !== 1) {
            throw new ConflictException(
              'O agendamento mudou. Recarregue a página e tente novamente.',
            );
          }
        }

        return { id: processId, removed_at: removedAt, removed_by: actorId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
  }
}
