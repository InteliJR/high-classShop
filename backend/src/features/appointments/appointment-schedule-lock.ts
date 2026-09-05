import { ConflictException } from '@nestjs/common';
import { StatusAgendamento } from '@prisma/client';
import { formatToISO, suggestNextAvailableSlots } from 'src/shared/utils/date.utils';

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
  const conflictStart = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
  const conflictEnd = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000);
  const existing = await tx.appointment.findFirst({
    where: {
      specialist_id: specialistId,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      appointment_datetime: { gte: conflictStart, lte: conflictEnd },
      status: {
        in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
      },
    },
  });
  if (!existing) return;

  throw new ConflictException({
    success: false,
    error: {
      code: 409,
      message: 'Especialista já possui agendamento neste horário',
      details: {
        conflicting_appointment: {
          id: existing.id,
          appointment_datetime: existing.appointment_datetime
            ? formatToISO(existing.appointment_datetime)
            : null,
          client_id: existing.client_id,
        },
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
