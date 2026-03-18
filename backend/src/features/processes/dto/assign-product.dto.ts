import { $Enums } from '@prisma/client';
import { IsNotEmpty, IsInt, Min, IsEnum } from 'class-validator';

/**
 * DTO para associar um produto a um processo de consultoria
 *
 * Usado via PATCH /api/processes/:id/assign-product
 *
 * Regras:
 * - Processo deve estar em status SCHEDULING
 * - Processo não deve ter produto associado (consultoria)
 * - Usuário deve ser o especialista do processo ou ADMIN
 * - Produto deve existir e pertencer ao especialista
 */
export class AssignProductToProcessDto {
  /**
   * Tipo do produto: CAR, BOAT ou AIRCRAFT
   * Deve corresponder à especialidade do especialista
   */
  @IsNotEmpty({ message: 'product_type é obrigatório' })
  @IsEnum($Enums.ProductType, {
    message: 'product_type deve ser CAR, BOAT ou AIRCRAFT',
  })
  product_type: $Enums.ProductType;

  /**
   * ID do produto específico (car_id, boat_id ou aircraft_id)
   * Deve existir na tabela correspondente e pertencer ao especialista
   */
  @IsNotEmpty({ message: 'product_id é obrigatório' })
  @IsInt({ message: 'product_id deve ser um número inteiro' })
  @Min(1, { message: 'product_id deve ser no mínimo 1' })
  product_id: number;
}
