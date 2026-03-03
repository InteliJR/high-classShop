import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Length,
  Matches,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum SpecialityEnum {
  CAR = 'CAR',
  BOAT = 'BOAT',
  AIRCRAFT = 'AIRCRAFT',
}

export class CreateSpecialistDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Sobrenome é obrigatório' })
  surname: string;

  @IsEmail({}, { message: 'Email deve ter formato válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório' })
  @Length(11, 11, { message: 'CPF deve ter exatamente 11 dígitos' })
  @Matches(/^\d+$/, { message: 'CPF deve conter apenas números' })
  cpf: string;

  @IsString()
  @IsNotEmpty({ message: 'RG é obrigatório' })
  @Length(9, 9, { message: 'RG deve ter exatamente 9 dígitos' })
  @Matches(/^\d+$/, { message: 'RG deve conter apenas números' })
  rg: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password_hash: string;

  @IsEnum(SpecialityEnum, {
    message: 'Especialidade deve ser CAR, BOAT ou AIRCRAFT',
  })
  @IsNotEmpty({ message: 'Especialidade é obrigatória' })
  speciality: SpecialityEnum;

  @IsUUID('4', { message: 'company_id deve ser um UUID válido' })
  @IsOptional()
  company_id?: string;

  @IsNumber({}, { message: 'Taxa de comissão deve ser um número' })
  @IsOptional()
  @Min(0, { message: 'Taxa de comissão deve ser >= 0' })
  @Max(100, { message: 'Taxa de comissão deve ser <= 100' })
  commission_rate?: number;
}
