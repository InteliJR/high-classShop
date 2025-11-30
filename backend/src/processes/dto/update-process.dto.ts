import { $Enums } from '@prisma/client';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProcessDto {
  @IsNotEmpty()
  status: $Enums.ProcessStatus;

  @IsOptional()
  notes: string;
}
