import { $Enums } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsUUID, IsInt, Min, ValidateIf, IsEnum } from 'class-validator';

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
  @IsOptional()
  @ValidateIf((o) => o.product_type !== undefined)
  @IsInt({ message: 'product_id deve ser um número inteiro' })
  @Min(1, { message: 'product_id deve ser no mínimo 1' })
  product_id?: number;

  /**
   * Tipo do produto: CAR, BOAT ou AIRCRAFT
   * Opcional para consultoria - será definido após reunião
   */
  @IsOptional()
  @ValidateIf((o) => o.product_id !== undefined)
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
