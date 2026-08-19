import { ProductType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';

export class OfficeManagerReplacementDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsUUID('4')
  company_id?: string;

  @IsOptional()
  @IsEnum(ProductType)
  speciality?: ProductType;
}

export class ChangeRoleDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsUUID('4')
  company_id?: string;

  @IsOptional()
  @IsEnum(ProductType)
  speciality?: ProductType;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfficeManagerReplacementDto)
  replacement?: OfficeManagerReplacementDto;
}
