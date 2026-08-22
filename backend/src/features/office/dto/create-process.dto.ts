import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum OfficeProductTypeEnum {
  CAR = 'CAR',
  BOAT = 'BOAT',
  AIRCRAFT = 'AIRCRAFT',
}

export class OfficeCreateProcessDto {
  @IsUUID('4', { message: 'client_id deve ser um UUID válido' })
  client_id: string;

  @IsUUID('4', { message: 'specialist_id deve ser um UUID válido' })
  specialist_id: string;

  @IsEnum(OfficeProductTypeEnum, {
    message: 'product_type deve ser CAR, BOAT ou AIRCRAFT',
  })
  product_type: OfficeProductTypeEnum;

  @IsUUID('4', { message: 'product_id deve ser um UUID válido' })
  @IsOptional()
  product_id?: string;

  // Só ADMIN usa: OFFICE tem a empresa resolvida a partir do próprio escopo,
  // e resolveCompanyId ignora este campo para quem não é ADMIN.
  @IsUUID('4', { message: 'company_id deve ser um UUID válido' })
  @IsOptional()
  company_id?: string;
}
