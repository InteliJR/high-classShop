import api from "./api";
import { stripFormatting } from "../utils/mask";
import type { ProductCurrency } from "../lib/currency";

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

export interface PrefillPlatform {
  name?: string;
  cnpj?: string;
  bank?: string;
  agency?: string;
  checking_account?: string;
  rate?: number;
  value?: number;
}

export interface PrefillOffice {
  name?: string;
  cnpj?: string;
  bank?: string;
  agency?: string;
  checking_account?: string;
  rate?: number;
  value?: number;
}

export interface PrefillSpecialist {
  id?: string;
  name?: string;
  email?: string;
  cnpj?: string;
  bank?: string;
  agency?: string;
  checking_account?: string;
  rate?: number;
  value?: number;
}

export interface PrefillContractResponse {
  process_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  currency: ProductCurrency;
  buyer: PrefillBuyer;
  seller: PrefillSeller;
  product: PrefillProduct;
  proposal?: PrefillProposal;
  platform?: PrefillPlatform;
  office?: PrefillOffice;
  specialist?: PrefillSpecialist;
  suggested_total_rate?: number;
}

// === TIPOS PARA GERAÇÃO DE CONTRATO ===

export interface GenerateContractData {
  process_id: string;
  operation_id: string;

  // Template DocuSign escolhido (opcional; backend faz fallback pro env)
  template_id?: string;

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

  // Comissão total da venda — único valor de comissão editável pelo especialista.
  // Plataforma e escritório ficam travados no backend nas taxas já cadastradas.
  total_commission_rate: number;

  // Dados da Plataforma (Split 1) — opcional, nem todo ambiente tem cadastro completo
  platform_name?: string;
  platform_cnpj?: string;
  platform_bank?: string;
  platform_agency?: string;
  platform_checking_account?: string;

  // Dados do Escritório (Split 2)
  office_name?: string;
  office_cnpj?: string;
  office_bank?: string;
  office_agency?: string;
  office_checking_account?: string;

  // Dados do Especialista (Split 3)
  specialist_name?: string;
  specialist_email?: string;
  specialist_document?: string;
  specialist_bank?: string;
  specialist_agency?: string;
  specialist_checking_account?: string;

  // Testemunhas (opcionais)
  testimonial1_name?: string;
  testimonial1_cpf?: string;
  testimonial1_email?: string;
  testimonial2_name?: string;
  testimonial2_cpf?: string;
  testimonial2_email?: string;

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

// === TIPOS PARA PREVIEW ===

// PreviewContractData inclui return_url para callback do DocuSign
export interface PreviewContractData extends GenerateContractData {
  return_url: string;
}

export interface PreviewContractResponse {
  preview_url: string;
  envelope_id: string;
  expires_at: string;
  process_id: string;
}

export interface SendContractResponse {
  id: string;
  envelope_id: string;
  process_id: string;
  status: string;
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
export interface ContractTemplate {
  templateId: string;
  name: string;
}

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const response =
    await api.get<ApiResponse<ContractTemplate[]>>("/contracts/templates");
  return response.data.data;
}

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
    platform_cnpj: data.platform_cnpj
      ? stripFormatting(data.platform_cnpj)
      : undefined,
    office_cnpj: data.office_cnpj ? stripFormatting(data.office_cnpj) : undefined,
    specialist_document: data.specialist_document
      ? stripFormatting(data.specialist_document)
      : undefined,
    testimonial1_cpf: data.testimonial1_cpf
      ? stripFormatting(data.testimonial1_cpf)
      : undefined,
    testimonial2_cpf: data.testimonial2_cpf
      ? stripFormatting(data.testimonial2_cpf)
      : undefined,
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

// === FUNÇÕES DE PREVIEW ===

/**
 * Cria um preview do contrato via DocuSign Sender View
 * @param data - Dados do formulário de contrato + returnUrl
 * @returns URL do preview, envelopeId e data de expiração
 */
export async function previewContract(
  data: PreviewContractData,
): Promise<PreviewContractResponse> {
  // Remover formatação dos campos numéricos antes de enviar
  const cleanData = {
    ...data,
    seller_cpf: stripFormatting(data.seller_cpf),
    seller_rg: data.seller_rg ? stripFormatting(data.seller_rg) : undefined,
    seller_cep: stripFormatting(data.seller_cep),
    buyer_cpf: stripFormatting(data.buyer_cpf),
    buyer_rg: data.buyer_rg ? stripFormatting(data.buyer_rg) : undefined,
    buyer_cep: stripFormatting(data.buyer_cep),
    platform_cnpj: data.platform_cnpj
      ? stripFormatting(data.platform_cnpj)
      : undefined,
    office_cnpj: data.office_cnpj ? stripFormatting(data.office_cnpj) : undefined,
    specialist_document: data.specialist_document
      ? stripFormatting(data.specialist_document)
      : undefined,
    testimonial1_cpf: data.testimonial1_cpf
      ? stripFormatting(data.testimonial1_cpf)
      : undefined,
    testimonial2_cpf: data.testimonial2_cpf
      ? stripFormatting(data.testimonial2_cpf)
      : undefined,
  };

  const response = await api.post<ApiResponse<PreviewContractResponse>>(
    "/contracts/preview",
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
 * Envia o contrato após preview
 * @param envelopeId - ID do envelope no DocuSign
 * @param data - Dados originais do formulário
 * @returns Contrato criado
 */
export async function sendContractAfterPreview(
  envelopeId: string,
  data: PreviewContractData,
): Promise<SendContractResponse> {
  // Remover formatação dos campos numéricos antes de enviar
  const cleanData = {
    ...data,
    seller_cpf: stripFormatting(data.seller_cpf),
    seller_rg: data.seller_rg ? stripFormatting(data.seller_rg) : undefined,
    seller_cep: stripFormatting(data.seller_cep),
    buyer_cpf: stripFormatting(data.buyer_cpf),
    buyer_rg: data.buyer_rg ? stripFormatting(data.buyer_rg) : undefined,
    buyer_cep: stripFormatting(data.buyer_cep),
    platform_cnpj: data.platform_cnpj
      ? stripFormatting(data.platform_cnpj)
      : undefined,
    office_cnpj: data.office_cnpj ? stripFormatting(data.office_cnpj) : undefined,
    specialist_document: data.specialist_document
      ? stripFormatting(data.specialist_document)
      : undefined,
    testimonial1_cpf: data.testimonial1_cpf
      ? stripFormatting(data.testimonial1_cpf)
      : undefined,
    testimonial2_cpf: data.testimonial2_cpf
      ? stripFormatting(data.testimonial2_cpf)
      : undefined,
  };

  const response = await api.post<ApiResponse<SendContractResponse>>(
    `/contracts/send/${envelopeId}`,
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
 * Cancela um preview de contrato
 * @param envelopeId - ID do envelope no DocuSign
 */
export async function cancelContractPreview(
  envelopeId: string,
  processId: string,
): Promise<void> {
  await api.post(
    `/contracts/cancel-preview/${envelopeId}`,
    { process_id: processId },
    { withCredentials: true },
  );
}
