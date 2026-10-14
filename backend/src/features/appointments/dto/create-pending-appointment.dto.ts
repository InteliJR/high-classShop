import { AppointmentSchedulingMethod } from '@prisma/client';
import { OmitType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreatePendingAppointmentDto extends OmitType(
  CreateAppointmentDto,
  ['appointment_datetime'] as const,
) {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'appointment_datetime deve ser uma data ISO 8601 válida' },
  )
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
