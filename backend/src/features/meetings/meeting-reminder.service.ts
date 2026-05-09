import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';

@Injectable()
export class MeetingReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeetingReminderService.name);
  private intervalRef?: NodeJS.Timeout;
  private readonly scanIntervalMs = 60 * 1000;
  private readonly alreadyNotified = new Map<string, number>(); // key: `${appointmentId}_${type}`

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.intervalRef = setInterval(() => {
      void this.scanAndNotify();
    }, this.scanIntervalMs);

    void this.scanAndNotify();
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  private pruneNotificationCache(now: number) {
    const twelveHours = 12 * 60 * 60 * 1000;
    for (const [appointmentId, timestamp] of this.alreadyNotified.entries()) {
      if (now - timestamp > twelveHours) {
        this.alreadyNotified.delete(appointmentId);
      }
    }
  }

  private async scanAndNotify() {
    const now = new Date();
    const nowTime = now.getTime();
    this.pruneNotificationCache(nowTime);

    // Janela 1: 13-17 min antes → lembrete "em 15 minutos"
    const window15Start = new Date(nowTime + 13 * 60 * 1000);
    const window15End = new Date(nowTime + 17 * 60 * 1000);

    // Janela 2: -2 a +2 min → lembrete "começando agora"
    const windowNowStart = new Date(nowTime - 2 * 60 * 1000);
    const windowNowEnd = new Date(nowTime + 2 * 60 * 1000);

    const appointments = await this.prismaService.appointment.findMany({
      where: {
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: {
          gte: windowNowStart,
          lte: window15End,
        },
        process: {
          is: {
            status: ProcessStatus.SCHEDULING,
          },
        },
      },
      include: {
        client: {
          select: { email: true, name: true, surname: true },
        },
        specialist: {
          select: { email: true, name: true, surname: true },
        },
        process: {
          select: { id: true },
        },
      },
    });

    for (const appointment of appointments) {
      if (!appointment.process || !appointment.appointment_datetime) {
        continue;
      }

      const apptTime = appointment.appointment_datetime.getTime();
      const clientName = `${appointment.client.name} ${appointment.client.surname || ''}`.trim();
      const specialistName = `${appointment.specialist.name} ${appointment.specialist.surname || ''}`.trim();

      const is15min =
        apptTime >= window15Start.getTime() && apptTime <= window15End.getTime();
      const isNow =
        apptTime >= windowNowStart.getTime() && apptTime <= windowNowEnd.getTime();

      const key15 = `${appointment.id}_15min`;
      const keyNow = `${appointment.id}_now`;

      if (is15min && !this.alreadyNotified.has(key15)) {
        this.alreadyNotified.set(key15, nowTime);
        Promise.allSettled([
          this.notificationService.sendMeetingReminderEmail({
            recipientEmail: appointment.client.email,
            recipientName: clientName || 'Cliente',
            counterpartName: specialistName || 'Especialista',
            appointmentDate: appointment.appointment_datetime,
            processId: appointment.process.id,
          }),
          this.notificationService.sendMeetingReminderEmail({
            recipientEmail: appointment.specialist.email,
            recipientName: specialistName || 'Especialista',
            counterpartName: clientName || 'Cliente',
            appointmentDate: appointment.appointment_datetime,
            processId: appointment.process.id,
          }),
        ]).catch((error) => {
          this.logger.error('Falha ao enviar lembrete 15min (não crítico)', {
            appointmentId: appointment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      if (isNow && !this.alreadyNotified.has(keyNow)) {
        this.alreadyNotified.set(keyNow, nowTime);
        Promise.allSettled([
          this.notificationService.sendMeetingReminderEmail({
            recipientEmail: appointment.client.email,
            recipientName: clientName || 'Cliente',
            counterpartName: specialistName || 'Especialista',
            appointmentDate: appointment.appointment_datetime,
            processId: appointment.process.id,
            isStartingNow: true,
          }),
          this.notificationService.sendMeetingReminderEmail({
            recipientEmail: appointment.specialist.email,
            recipientName: specialistName || 'Especialista',
            counterpartName: clientName || 'Cliente',
            appointmentDate: appointment.appointment_datetime,
            processId: appointment.process.id,
            isStartingNow: true,
          }),
        ]).catch((error) => {
          this.logger.error('Falha ao enviar lembrete no horário (não crítico)', {
            appointmentId: appointment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }
  }
}
