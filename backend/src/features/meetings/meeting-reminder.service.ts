import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';

@Injectable()
export class MeetingReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeetingReminderService.name);
  private intervalRef?: NodeJS.Timeout;
  private readonly scanIntervalMs = 60 * 1000;
  private readonly alreadyNotified = new Map<string, number>();

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

    const windowStart = new Date(nowTime + 9 * 60 * 1000);
    const windowEnd = new Date(nowTime + 11 * 60 * 1000);

    const appointments = await this.prismaService.appointment.findMany({
      where: {
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: {
          gte: windowStart,
          lte: windowEnd,
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

      if (this.alreadyNotified.has(appointment.id)) {
        continue;
      }

      const clientName = `${appointment.client.name} ${appointment.client.surname || ''}`.trim();
      const specialistName = `${appointment.specialist.name} ${appointment.specialist.surname || ''}`.trim();

      this.alreadyNotified.set(appointment.id, nowTime);

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
        this.logger.error('Falha ao enviar lembrete de reunião (não crítico)', {
          appointmentId: appointment.id,
          processId: appointment.process?.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}
