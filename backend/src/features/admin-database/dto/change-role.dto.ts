import { ProductType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OfficeManagerReplacementDto {
  @IsEnum(UserRole, {
    message:
      'O novo cargo do gerente atual deve ser Cliente, Consultor, Especialista ou Administrador.',
  })
  role: UserRole;

  @IsOptional()
  @IsUUID('4', { message: 'O escritório deve ter um identificador válido.' })
  company_id?: string;

  @IsOptional()
  @IsEnum(ProductType, {
    message: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
  })
  speciality?: ProductType;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'A comissão deve ser um número com no máximo duas casas decimais.' },
  )
  @Min(0, { message: 'A comissão deve estar entre 0% e 100%.' })
  @Max(100, { message: 'A comissão deve estar entre 0% e 100%.' })
  commission_rate?: number;
}

export class ChangeRoleDto {
  @IsEnum(UserRole, {
    message:
      'O cargo deve ser Cliente, Consultor, Especialista, Gerente de escritório ou Administrador.',
  })
  role: UserRole;

  @IsOptional()
  @IsUUID('4', { message: 'O escritório deve ter um identificador válido.' })
  company_id?: string;

  @IsOptional()
  @IsEnum(ProductType, {
    message: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
  })
  speciality?: ProductType;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'A comissão deve ser um número com no máximo duas casas decimais.' },
  )
  @Min(0, { message: 'A comissão deve estar entre 0% e 100%.' })
  @Max(100, { message: 'A comissão deve estar entre 0% e 100%.' })
  commission_rate?: number;

  @IsOptional()
  @ValidateNested({
    message: 'Informe dados válidos para o novo cargo do gerente atual.',
  })
  @Type(() => OfficeManagerReplacementDto)
  replacement?: OfficeManagerReplacementDto;
}
