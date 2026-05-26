import { IsUUID, IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum ProductTypeEnum {
  CAR = 'CAR',
  BOAT = 'BOAT',
  AIRCRAFT = 'AIRCRAFT',
}

export class CreateConsultantProcessDto {
  @IsUUID('4', { message: 'client_id deve ser um UUID válido' })
  client_id: string;

  @IsUUID('4', { message: 'specialist_id deve ser um UUID válido' })
  specialist_id: string;

  @IsEnum(ProductTypeEnum, { message: 'product_type deve ser CAR, BOAT ou AIRCRAFT' })
  product_type: ProductTypeEnum;

  @IsNumber({}, { message: 'product_id deve ser um número inteiro' })
  @IsOptional()
  product_id?: number; // ID do produto (car_id, boat_id ou aircraft_id — Int PKs)
}
