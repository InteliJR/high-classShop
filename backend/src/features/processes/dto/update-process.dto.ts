import { $Enums, ProcessStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProcessDto {
  @IsNotEmpty()
  @IsEnum(ProcessStatus)
  status: $Enums.ProcessStatus;

  @IsOptional()
  notes: string;
}
