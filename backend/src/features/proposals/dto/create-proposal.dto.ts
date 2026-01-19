import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO para criar uma nova proposta de negociação
 *
 * Regras de negócio:
 * - proposed_value deve ser >= 80% do valor do produto (validado no service)
 * - Apenas participantes do processo (client_id ou specialist_id) podem criar propostas
 * - Só pode criar proposta se processo está em NEGOTIATION
 * - Alternância: se última proposta foi do cliente, próxima deve ser do especialista
 *
 * Frontend:
 * - Enviar process_id do processo em negociação
 * - proposed_value em número (será convertido para Decimal no backend)
 * - message opcional para contextualizar a proposta
 * - counter_to_id quando responder a uma proposta existente
 */
export class CreateProposalDto {
  /**
   * ID do processo em negociação (UUID)
   * Validação: processo deve existir e estar em status NEGOTIATION
   */
  @IsUUID('4', { message: 'process_id deve ser um UUID válido' })
  process_id: string;

  /**
   * Valor proposto em número
   * Validação: deve ser >= 80% do valor do produto
   * Frontend deve exibir % de desconto em tempo real
   */
  @IsNumber({}, { message: 'proposed_value deve ser um número' })
  @Min(0.01, { message: 'proposed_value deve ser maior que zero' })
  proposed_value: number;

  /**
   * Mensagem opcional para contextualizar a proposta
   * Máximo 500 caracteres
   * Exemplos: "Tenho interesse imediato", "Posso fechar hoje"
   */
  @IsOptional()
  @IsString({ message: 'message deve ser uma string' })
  @MaxLength(500, { message: 'message não pode ter mais que 500 caracteres' })
  message?: string;

  /**
   * ID da proposta que esta responde (para contrapropostas)
   * Se não fornecido, é uma proposta inicial
   * Validação: proposta original deve existir e estar PENDING
   */
  @IsOptional()
  @IsUUID('4', { message: 'counter_to_id deve ser um UUID válido' })
  counter_to_id?: string;
}
