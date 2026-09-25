import { AppointmentSchedulingMethod } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreatePendingAppointmentDto extends CreateAppointmentDto {
  @IsOptional()
  @IsIn(
    [
      AppointmentSchedulingMethod.EMAIL,
      AppointmentSchedulingMethod.CALENDLY,
    ],
    {
      message: 'scheduling_method deve ser EMAIL ou CALENDLY',
    },
  )
  scheduling_method?: AppointmentSchedulingMethod;
}
