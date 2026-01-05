import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para criação de contrato
 *
 * Validações:
 * - process_id: UUID obrigatório (referencia a um Process existente)
 * - client_email: Email válido e obrigatório (deve estar registrado no sistema)
 * - description: String opcional (até 1000 caracteres)
 */
export class CreateContractDto {
  /**
   * ID do processo ao qual este contrato pertence
   * Deve existir no banco de dados
   *
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', {
    message: 'process_id deve ser um UUID v4 válido',
  })
  @IsNotEmpty({
    message: 'process_id é obrigatório',
  })
  process_id: string;

  /**
   * Email do cliente que irá assinar o contrato
   * Deve ser um usuário registrado no sistema
   *
   * @example "cliente@example.com"
   */
  @IsEmail(
    {},
    {
      message: 'client_email deve ser um email válido',
    },
  )
  @IsNotEmpty({
    message: 'client_email é obrigatório',
  })
  client_email: string;

  /**
   * Descrição opcional do contrato
   * Máximo 1000 caracteres
   *
   * @example "Contrato de compra de Ferrari Testarossa"
   */
  @IsOptional()
  @IsString({
    message: 'description deve ser uma string',
  })
  @MinLength(3, {
    message: 'description deve ter no mínimo 3 caracteres',
  })
  @MaxLength(1000, {
    message: 'description deve ter no máximo 1000 caracteres',
  })
  description?: string;
}
