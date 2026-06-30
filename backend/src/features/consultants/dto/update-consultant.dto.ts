import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateConsultantDto } from './create-consultant.dto';
import { IsString, IsOptional } from 'class-validator';

// Remove o campo password do CreateConsultantDto. A senha é recebida em texto puro
// via `password` e sempre passada por hash no service — `password_hash` NÃO é aceito
// do cliente para evitar gravação de hash cru / bypass do bcrypt.
export class UpdateConsultantDto extends PartialType(
  OmitType(CreateConsultantDto, ['password'] as const),
) {
  @IsString()
  @IsOptional()
  password?: string;
}
