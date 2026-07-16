import {
  IsString,
  IsEmail,
  Matches,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { SpecialityEnum } from './create-specialist.dto';

/**
 * Não usa PartialType(CreateSpecialistDto): o campo de documento do
 * especialista precisa aceitar CPF (11) ou CNPJ (14) na atualização —
 * cadastros antigos ainda têm CPF gravado e não podem ficar bloqueados
 * ao editar outros campos. PartialType só tornaria opcional a validação
 * estrita de CreateSpecialistDto (CNPJ de 14 dígitos), sem afrouxá-la.
 */
export class UpdateSpecialistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  surname?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email deve ter formato válido' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'Documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos',
  })
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9,10}$/, { message: 'RG deve conter 9 ou 10 dígitos' })
  rg?: string;

  @IsOptional()
  @IsString()
  password_hash?: string;

  @IsOptional()
  @IsEnum(SpecialityEnum, {
    message: 'Especialidade deve ser CAR, BOAT ou AIRCRAFT',
  })
  speciality?: SpecialityEnum;

  @IsOptional()
  @IsNumber({}, { message: 'Taxa de comissão deve ser um número' })
  @Min(0, { message: 'Taxa de comissão deve ser >= 0' })
  @Max(100, { message: 'Taxa de comissão deve ser <= 100' })
  commission_rate?: number;

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  agency?: string;

  @IsOptional()
  @IsString()
  checking_account?: string;

  @IsOptional()
  @IsString()
  calendly_url?: string;
}
