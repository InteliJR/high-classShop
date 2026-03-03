import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProcessStatus } from '@prisma/client';

/**
 * DTO para filtrar processos do especialista
 * Usado em GET /api/processes/specialist/:id
 */
export class GetProcessesFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  perPage?: number;

  /**
   * Filtrar por status do processo
   * Valores: SCHEDULING, NEGOTIATION, PROCESSING_CONTRACT, DOCUMENTATION, COMPLETED, REJECTED
   */
  @IsOptional()
  @IsEnum(ProcessStatus, {
    message:
      'status deve ser: SCHEDULING, NEGOTIATION, PROCESSING_CONTRACT, DOCUMENTATION, COMPLETED ou REJECTED',
  })
  @Transform(({ value }) => value?.toUpperCase())
  status?: ProcessStatus;

  /**
   * Busca textual por nome do cliente, email ou nome do produto (marca/modelo)
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * Ordenação: created_at (default), updated_at, status
   */
  @IsOptional()
  @IsString()
  sortBy?: 'created_at' | 'updated_at' | 'status';

  /**
   * Direção da ordenação: asc ou desc (default)
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  order?: 'asc' | 'desc';
}
