import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para rejeitar um processo
 *
 * Campos:
 * - rejection_reason: motivo da rejeição (opcional)
 *
 * Usado pelo endpoint PATCH /processes/:id/reject
 * Grava o motivo na tabela ProcessRejection
 */
export class RejectProcessDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'Motivo da rejeição deve ter no máximo 1000 caracteres',
  })
  rejection_reason?: string;
}
