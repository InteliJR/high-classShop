import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO para geração de contrato via formulário
 *
 * Todos os campos de formatação (CPF, CNPJ, CEP) devem ser enviados
 * SEM formatação (apenas números). O backend irá formatar antes de
 * enviar ao DocuSign.
 *
 * Valores monetários devem ser enviados como números decimais.
 */
export class GenerateContractDto {
  /**
   * ID do processo ao qual este contrato pertence
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', { message: 'process_id deve ser um UUID v4 válido' })
  @IsNotEmpty({ message: 'process_id é obrigatório' })
  process_id: string;

  // === VENDEDOR (SELLER) ===

  @IsString({ message: 'seller_name deve ser uma string' })
  @IsNotEmpty({ message: 'seller_name é obrigatório' })
  @MaxLength(255, { message: 'seller_name deve ter no máximo 255 caracteres' })
  seller_name: string;

  @IsEmail({}, { message: 'seller_email deve ser um email válido' })
  @IsNotEmpty({ message: 'seller_email é obrigatório' })
  seller_email: string;

  @IsString({ message: 'seller_cpf deve ser uma string' })
  @IsNotEmpty({ message: 'seller_cpf é obrigatório' })
  seller_cpf: string;

  @IsString({ message: 'seller_rg deve ser uma string' })
  @IsOptional()
  seller_rg?: string;

  @IsString({ message: 'seller_address deve ser uma string' })
  @IsNotEmpty({ message: 'seller_address é obrigatório' })
  seller_address: string;

  @IsString({ message: 'seller_cep deve ser uma string' })
  @IsNotEmpty({ message: 'seller_cep é obrigatório' })
  seller_cep: string;

  @IsString({ message: 'seller_bank deve ser uma string' })
  @IsNotEmpty({ message: 'seller_bank é obrigatório' })
  seller_bank: string;

  @IsString({ message: 'seller_agency deve ser uma string' })
  @IsNotEmpty({ message: 'seller_agency é obrigatório' })
  seller_agency: string;

  @IsString({ message: 'seller_checking_account deve ser uma string' })
  @IsNotEmpty({ message: 'seller_checking_account é obrigatório' })
  seller_checking_account: string;

  // === COMPRADOR (BUYER) ===

  @IsString({ message: 'buyer_name deve ser uma string' })
  @IsNotEmpty({ message: 'buyer_name é obrigatório' })
  @MaxLength(255, { message: 'buyer_name deve ter no máximo 255 caracteres' })
  buyer_name: string;

  @IsEmail({}, { message: 'buyer_email deve ser um email válido' })
  @IsNotEmpty({ message: 'buyer_email é obrigatório' })
  buyer_email: string;

  @IsString({ message: 'buyer_cpf deve ser uma string' })
  @IsNotEmpty({ message: 'buyer_cpf é obrigatório' })
  buyer_cpf: string;

  @IsString({ message: 'buyer_rg deve ser uma string' })
  @IsOptional()
  buyer_rg?: string;

  @IsString({ message: 'buyer_address deve ser uma string' })
  @IsNotEmpty({ message: 'buyer_address é obrigatório' })
  buyer_address: string;

  @IsString({ message: 'buyer_cep deve ser uma string' })
  @IsNotEmpty({ message: 'buyer_cep é obrigatório' })
  buyer_cep: string;

  // === VEÍCULO/PRODUTO ===

  @IsString({ message: 'vehicle_model deve ser uma string' })
  @IsNotEmpty({ message: 'vehicle_model é obrigatório' })
  vehicle_model: string;

  @IsString({ message: 'vehicle_year deve ser uma string' })
  @IsNotEmpty({ message: 'vehicle_year é obrigatório' })
  vehicle_year: string;

  @IsString({ message: 'vehicle_registration_id deve ser uma string' })
  @IsNotEmpty({ message: 'vehicle_registration_id é obrigatório' })
  vehicle_registration_id: string;

  @IsString({ message: 'vehicle_serial_number deve ser uma string' })
  @IsNotEmpty({ message: 'vehicle_serial_number é obrigatório' })
  vehicle_serial_number: string;

  @IsString({ message: 'vehicle_technical_info deve ser uma string' })
  @IsOptional()
  vehicle_technical_info?: string;

  @IsNumber({}, { message: 'vehicle_price deve ser um número' })
  @IsNotEmpty({ message: 'vehicle_price é obrigatório' })
  @Min(0, { message: 'vehicle_price deve ser maior ou igual a zero' })
  vehicle_price: number;

  // === PAGAMENTO AO VENDEDOR ===

  @IsNumber({}, { message: 'payment_seller_value deve ser um número' })
  @IsNotEmpty({ message: 'payment_seller_value é obrigatório' })
  @Min(0, { message: 'payment_seller_value deve ser maior ou igual a zero' })
  payment_seller_value: number;

  // === COMISSÃO DA PLATAFORMA ===

  @IsNumber({}, { message: 'commission_value deve ser um número' })
  @IsNotEmpty({ message: 'commission_value é obrigatório' })
  @Min(0, { message: 'commission_value deve ser maior ou igual a zero' })
  commission_value: number;

  @IsString({ message: 'commission_name deve ser uma string' })
  @IsNotEmpty({ message: 'commission_name é obrigatório' })
  commission_name: string;

  @IsString({ message: 'commission_cpf deve ser uma string' })
  @IsNotEmpty({ message: 'commission_cpf é obrigatório (CNPJ)' })
  commission_cpf: string;

  @IsString({ message: 'commission_bank deve ser uma string' })
  @IsNotEmpty({ message: 'commission_bank é obrigatório' })
  commission_bank: string;

  @IsString({ message: 'commission_agency deve ser uma string' })
  @IsNotEmpty({ message: 'commission_agency é obrigatório' })
  commission_agency: string;

  @IsString({ message: 'commission_checking_account deve ser uma string' })
  @IsNotEmpty({ message: 'commission_checking_account é obrigatório' })
  commission_checking_account: string;

  // === CIDADE DE ASSINATURA ===

  @IsString({ message: 'city deve ser uma string' })
  @IsNotEmpty({ message: 'city é obrigatório' })
  city: string;

  // === DESCRIÇÃO OPCIONAL ===

  @IsString({ message: 'description deve ser uma string' })
  @IsOptional()
  @MaxLength(1000, {
    message: 'description deve ter no máximo 1000 caracteres',
  })
  description?: string;
}
