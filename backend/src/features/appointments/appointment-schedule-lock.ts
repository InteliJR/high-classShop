import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  CalendlySyncStatus,
  Prisma,
  StatusAgendamento,
} from '@prisma/client';
import { suggestNextAvailableSlots } from 'src/shared/utils/date.utils';

export function buildOccupiedScheduleWhere(
  specialistId: string,
  appointmentDateTime: Date,
  excludeAppointmentId?: string,
): Prisma.AppointmentWhereInput {
  const hour = 60 * 60 * 1000;
  return {
    specialist_id: specialistId,
    ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    appointment_datetime: {
      gte: new Date(appointmentDateTime.getTime() - hour),
      lte: new Date(appointmentDateTime.getTime() + hour),
    },
    OR: [
      { status: StatusAgendamento.SCHEDULED },
      {
        status: StatusAgendamento.PENDING,
        scheduling_method: AppointmentSchedulingMethod.CALENDLY,
        calendly_sync_status: CalendlySyncStatus.SYNCED,
      },
      { status: StatusAgendamento.PENDING, scheduling_method: null },
    ],
  };
}

export async function acquireSpecialistScheduleLock(
  tx: any,
  specialistId: string,
): Promise<void> {
  const lockKey = `appointment-schedule:${specialistId}`;
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
  `;
}

export async function assertSpecialistScheduleAvailable(
  tx: any,
  specialistId: string,
  appointmentDateTime: Date | null,
  excludeAppointmentId?: string,
): Promise<void> {
  if (!appointmentDateTime) return;
  const existing = await tx.appointment.findFirst({
    where: buildOccupiedScheduleWhere(
      specialistId,
      appointmentDateTime,
      excludeAppointmentId,
    ),
    select: { id: true },
  });
  if (!existing) return;

  throw new ConflictException({
    success: false,
    error: {
      code: 409,
      message: 'Especialista já possui agendamento neste horário',
      details: {
        suggested_times: suggestNextAvailableSlots(appointmentDateTime, 3),
      },
    },
  });
}

export async function lockAndAssertSpecialistScheduleAvailable(
  tx: any,
  specialistId: string,
  appointmentDateTime: Date | null,
  excludeAppointmentId?: string,
): Promise<void> {
  await acquireSpecialistScheduleLock(tx, specialistId);
  await assertSpecialistScheduleAvailable(
    tx,
    specialistId,
    appointmentDateTime,
    excludeAppointmentId,
  );
}
