import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateConsultantDto } from './create-consultant.dto';
import { IsString, IsOptional } from 'class-validator';

// Remove o campo password do CreateConsultantDto e adiciona password_hash como opcional
export class UpdateConsultantDto extends PartialType(
  OmitType(CreateConsultantDto, ['password'] as const)
) {
  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  password_hash?: string;
}
