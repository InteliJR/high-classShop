import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { EnvelopeStatus } from '../../enums/envelope-status.enum';

// DTO para o retorno básico da criação de envelope
export class CreateEnvelopeResponseDto {
  @IsString()
  @IsNotEmpty()
  envelopeId: string;

  @IsEnum(EnvelopeStatus)
  @IsNotEmpty()
  status: EnvelopeStatus;

  @IsDateString()
  statusDateTime: string; // ISO string

  @IsString()
  @IsNotEmpty()
  uri: string;

  // Campos opcionais
  @IsOptional()
  @IsString()
  contractId?: string; // ID do contrato no seu banco

  @IsOptional()
  @IsString()
  signerEmail?: string; // email do signer principal

  @IsOptional()
  @IsString()
  signerName?: string; // nome do signer

  @IsOptional()
  @Type(() => Object)
  providerMeta?: Record<string, any>; // meta dados do envelope (logs, tabs, etc.)
}
