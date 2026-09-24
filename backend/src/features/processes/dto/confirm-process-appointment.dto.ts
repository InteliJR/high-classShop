import { IsDateString, IsOptional } from 'class-validator';

export class ConfirmProcessAppointmentDto {
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'appointment_datetime deve ser uma data ISO 8601 válida',
    },
  )
  appointment_datetime?: string;
}
