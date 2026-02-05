import api from "./api";

// === TIPOS PARA PREFILL ===

export interface PrefillBuyer {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  rg?: string;
  address?: string;
  cep?: string;
}

export interface PrefillSeller {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  rg?: string;
  address?: string;
  cep?: string;
}

export interface PrefillProduct {
  id: number;
  brand: string;
  model: string;
  year: number;
  price: number;
  registration_id?: string;
  serial_number?: string;
  technical_info?: string;
}

export interface PrefillProposal {
  id: string;
  value: number;
}

export interface PrefillCommission {
  name?: string;
  cpf?: string;
  bank?: string;
  agency?: string;
  checking_account?: string;
}

export interface PrefillContractResponse {
  process_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  buyer: PrefillBuyer;
  seller: PrefillSeller;
  product: PrefillProduct;
  proposal?: PrefillProposal;
  commission?: PrefillCommission;
}

// === TIPOS PARA GERAÇÃO DE CONTRATO ===

export interface GenerateContractData {
  process_id: string;

  // Vendedor
  seller_name: string;
  seller_email: string;
  seller_cpf: string;
  seller_rg?: string;
  seller_address: string;
  seller_cep: string;
  seller_bank: string;
  seller_agency: string;
  seller_checking_account: string;

  // Comprador
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_rg?: string;
  buyer_address: string;
  buyer_cep: string;

  // Veículo
  vehicle_model: string;
  vehicle_year: string;
  vehicle_registration_id: string;
  vehicle_serial_number: string;
  vehicle_technical_info?: string;
  vehicle_price: number;

  // Pagamento
  payment_seller_value: number;

  // Comissão
  commission_value: number;
  commission_name: string;
  commission_cpf: string;
  commission_bank: string;
  commission_agency: string;
  commission_checking_account: string;

  // Cidade
  city: string;

  // Descrição
  description?: string;
}

export interface ContractResponse {
  id: string;
  process_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// === FUNÇÕES DE API ===

/**
 * Busca dados para pré-preencher o formulário de contrato
 * @param processId - ID do processo
 * @returns Dados do comprador, vendedor, produto e proposta
 */
export async function prefillContract(
  processId: string,
): Promise<PrefillContractResponse> {
  const response = await api.get<ApiResponse<PrefillContractResponse>>(
    `/contracts/prefill/${processId}`,
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Gera um novo contrato via formulário
 * @param data - Dados do formulário de contrato
 * @returns Contrato criado
 */
export async function generateContract(
  data: GenerateContractData,
): Promise<ContractResponse> {
  // Remover formatação dos campos numéricos antes de enviar
  const cleanData = {
    ...data,
    seller_cpf: stripFormatting(data.seller_cpf),
    seller_rg: data.seller_rg ? stripFormatting(data.seller_rg) : undefined,
    seller_cep: stripFormatting(data.seller_cep),
    buyer_cpf: stripFormatting(data.buyer_cpf),
    buyer_rg: data.buyer_rg ? stripFormatting(data.buyer_rg) : undefined,
    buyer_cep: stripFormatting(data.buyer_cep),
    commission_cpf: stripFormatting(data.commission_cpf),
  };

  const response = await api.post<ApiResponse<ContractResponse>>(
    "/contracts/generate",
    cleanData,
    {
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    },
  );

  return response.data.data;
}

/**
 * Get contract by ID
 * @param contractId - ID of the contract to retrieve
 */
export async function getContract(
  contractId: string,
): Promise<ContractResponse> {
  const response = await api.get<ApiResponse<ContractResponse>>(
    `/contracts/${contractId}`,
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * List all contracts (admin/specialist only)
 */
export async function listContracts(): Promise<ContractResponse[]> {
  const response = await api.get<ApiResponse<ContractResponse[]>>(
    "/contracts",
    { withCredentials: true },
  );
  return response.data.data;
}

// === HELPERS DE FORMATAÇÃO ===

/**
 * Remove formatação de string, mantendo apenas dígitos
 */
export function stripFormatting(value: string): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/**
 * Formata CPF para exibição: ###.###.###-##
 */
export function formatCpf(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Formata CNPJ para exibição: ##.###.###/####-##
 */
export function formatCnpj(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length !== 14) return value;
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  );
}

/**
 * Formata CEP para exibição: #####-###
 */
export function formatCep(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length !== 8) return value;
  return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
}

/**
 * Formata RG para exibição
 */
export function formatRg(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, "$1.$2.$3-$4");
  }
  return value;
}

/**
 * Formata valor monetário em BRL
 */
export function formatBRL(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Aplica máscara de CPF enquanto o usuário digita
 */
export function applyCpfMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 11);
  let formatted = digits;
  if (digits.length > 3) formatted = digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length > 6)
    formatted = formatted.slice(0, 7) + "." + digits.slice(6);
  if (digits.length > 9)
    formatted = formatted.slice(0, 11) + "-" + digits.slice(9);
  return formatted;
}

/**
 * Aplica máscara de CNPJ enquanto o usuário digita
 */
export function applyCnpjMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 14);
  let formatted = digits;
  if (digits.length > 2) formatted = digits.slice(0, 2) + "." + digits.slice(2);
  if (digits.length > 5)
    formatted = formatted.slice(0, 6) + "." + digits.slice(5);
  if (digits.length > 8)
    formatted = formatted.slice(0, 10) + "/" + digits.slice(8);
  if (digits.length > 12)
    formatted = formatted.slice(0, 15) + "-" + digits.slice(12);
  return formatted;
}

/**
 * Aplica máscara de CEP enquanto o usuário digita
 */
export function applyCepMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 8);
  if (digits.length > 5) {
    return digits.slice(0, 5) + "-" + digits.slice(5);
  }
  return digits;
}
