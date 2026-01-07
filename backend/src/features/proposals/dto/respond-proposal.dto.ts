import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para responder a uma proposta de negociação (aceitar ou rejeitar)
 *
 * Regras de negócio:
 * - Apenas o destinatário (proposed_to) pode responder
 * - Proposta deve estar em status PENDING
 * - Se aceitar: processo move para PROCESSING_CONTRACT
 * - Se rejeitar: permite nova proposta do rejeitador
 */
export class RespondProposalDto {
  /**
   * Mensagem opcional ao responder
   * Útil para explicar motivo de rejeição
   */
  @IsOptional()
  @IsString({ message: 'message deve ser uma string' })
  @MaxLength(500, { message: 'message não pode ter mais que 500 caracteres' })
  message?: string;
}
