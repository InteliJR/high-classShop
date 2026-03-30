import { ProductType } from '@prisma/client';

/**
 * DTO de resposta para pré-preenchimento do formulário de contrato
 *
 * Retorna dados do cliente, especialista, produto e proposta aceita
 * para popular o formulário no frontend
 */
export class PrefillContractResponseDto {
  process_id: string;
  product_type: ProductType;

  // Dados do comprador (cliente)
  buyer: {
    id: string;
    name: string;
    email: string;
    cpf?: string;
    rg?: string;
    address?: string;
    cep?: string;
  };

  // Dados do vendedor (preenchimento manual e independente do especialista)
  seller: {
    id: string;
    name: string;
    email: string;
    cpf?: string;
    rg?: string;
    address?: string;
    cep?: string;
  };

  // Dados do produto
  product: {
    id: number;
    brand: string;
    model: string;
    year: number;
    price: number;
    registration_id?: string; // placa/inscrição/prefixo
    serial_number?: string; // chassi/hull_number/serial
    technical_info?: string;
  };

  // Dados da proposta aceita
  proposal?: {
    id: string;
    value: number;
  };

  // Dados da Plataforma (Split 1) - PlatformCompany
  platform?: {
    name?: string;
    cnpj?: string;
    bank?: string;
    agency?: string;
    checking_account?: string;
    rate?: number; // Taxa de comissão em % (ex: 10.00 = 10%)
    value?: number; // Valor calculado da comissão em R$
  };

  // Dados do Escritório/Empresa (Split 2) - Company do especialista
  office?: {
    name?: string;
    cnpj?: string;
    bank?: string; // Opcional - só preenchido se empresa tiver dados bancários
    agency?: string;
    checking_account?: string;
    rate?: number; // Taxa de comissão em % (ex: 5.00 = 5%)
    value?: number; // Valor calculado da comissão em R$
  };

  // Dados do Especialista (Split 3) - Comissão individual do especialista
  specialist?: {
    id: string;
    name: string;
    email?: string;
    cpf?: string;
    bank?: string;
    agency?: string;
    checking_account?: string;
    rate?: number; // Taxa de comissão em % (ex: 3.00 = 3%)
    value?: number; // Valor calculado da comissão em R$
  };
}
