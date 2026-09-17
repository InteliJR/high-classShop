import { IsDateString, IsDefined } from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreatePlatformAppointmentDto extends OmitType(
  CreateAppointmentDto,
  ['appointment_datetime'] as const,
) {
  @IsDefined({ message: 'appointment_datetime é obrigatório' })
  @IsDateString(
    {},
    {
      message:
        'appointment_datetime deve ser uma data ISO 8601 válida',
    },
  )
  appointment_datetime: string;
}
