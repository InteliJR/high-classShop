import { ProductType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';

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
  @ValidateNested({
    message: 'Informe dados válidos para o novo cargo do gerente atual.',
  })
  @Type(() => OfficeManagerReplacementDto)
  replacement?: OfficeManagerReplacementDto;
}
