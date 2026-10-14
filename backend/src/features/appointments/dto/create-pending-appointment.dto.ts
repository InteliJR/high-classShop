import { AppointmentSchedulingMethod } from '@prisma/client';
import { OmitType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export const PENDING_APPOINTMENT_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

export class CreatePendingAppointmentDto extends OmitType(
  CreateAppointmentDto,
  ['appointment_datetime'] as const,
) {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'appointment_datetime deve ser uma data ISO 8601 válida' },
  )
  @Matches(PENDING_APPOINTMENT_DATETIME_PATTERN, {
    message:
      'appointment_datetime deve incluir data, hora e Z ou offset explícito',
  })
  appointment_datetime?: string;

  @IsOptional()
  @IsIn(
    [AppointmentSchedulingMethod.EMAIL, AppointmentSchedulingMethod.CALENDLY],
    {
      message: 'scheduling_method deve ser EMAIL ou CALENDLY',
    },
  )
  scheduling_method?: AppointmentSchedulingMethod;
}
