import { $Enums } from '@prisma/client';
import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
  IsEnum,
} from 'class-validator';

/**
 * DTO para criar novo processo
 *
 * Dois modos suportados:
 * 1. Com produto: product_type e product_id obrigatórios
 * 2. Consultoria: product_type e product_id opcionais (serão definidos depois)
 *
 * Se product_type for fornecido, product_id também deve ser fornecido e vice-versa
 */
export class CreateProcessDTO {
  @IsUUID()
  @IsNotEmpty()
  client_id: string;

  /**
   * ID do produto (car_id, boat_id ou aircraft_id)
   * Opcional para consultoria - será definido após reunião
   */
  @ValidateIf(
    (o) => o.product_type !== undefined || o.product_id !== undefined,
  )
  @IsUUID('4', { message: 'product_id deve ser um UUID válido' })
  product_id?: string;

  /**
   * Tipo do produto: CAR, BOAT ou AIRCRAFT
   * Opcional para consultoria - será definido após reunião
   */
  @ValidateIf(
    (o) => o.product_type !== undefined || o.product_id !== undefined,
  )
  @IsEnum($Enums.ProductType, {
    message: 'product_type deve ser CAR, BOAT ou AIRCRAFT',
  })
  product_type?: $Enums.ProductType;

  @IsNotEmpty()
  @IsUUID()
  specialist_id: string;

  @IsOptional()
  notes?: string;
}
