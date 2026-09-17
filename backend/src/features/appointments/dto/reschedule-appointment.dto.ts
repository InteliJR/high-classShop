import { IsDateString } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString(
    {},
    {
      message:
        'appointment_datetime deve ser uma data ISO 8601 válida',
    },
  )
  appointment_datetime: string;
}
