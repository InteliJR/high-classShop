import api from "./api";

/**
 * Interface para uma proposta de negociação
 */
export interface NegotiationProposal {
  id: string;
  process_id: string;
  proposed_value: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED";
  message?: string;
  counter_to_id?: string;
  created_at: string;
  updated_at: string;
  proposed_by: {
    id: string;
    name: string;
    surname: string;
    role: "CUSTOMER" | "SPECIALIST" | "CONSULTANT" | "ADMIN";
  };
  proposed_to: {
    id: string;
    name: string;
    surname: string;
    role: "CUSTOMER" | "SPECIALIST" | "CONSULTANT" | "ADMIN";
  };
}

/**
 * Interface para informações do processo na negociação
 */
export interface NegotiationProcessInfo {
  id: string;
  status: string;
  product_type: string;
  product_value: number;
  minimum_value: number;
  client: {
    id: string;
    name: string;
    surname: string;
  };
  specialist: {
    id: string;
    name: string;
    surname: string;
  };
}

/**
 * Interface para metadados da negociação
 */
export interface NegotiationMeta {
  total: number;
  pending_response_from?: string;
  can_create_proposal: boolean;
  accepted_proposal_id?: string;
}

/**
 * Interface para resposta da API de propostas
 */
export interface ProposalsResponse {
  success: boolean;
  message: string;
  data: NegotiationProposal[];
  process: NegotiationProcessInfo;
  meta: NegotiationMeta;
}

/**
 * Interface para criar uma proposta
 */
export interface CreateProposalRequest {
  process_id: string;
  proposed_value: number;
  message?: string;
  counter_to_id?: string;
}

/**
 * Busca todas as propostas de um processo
 * @param processId - ID do processo
 * @returns Lista de propostas com metadados
 */
export async function getProcessProposals(
  processId: string
): Promise<ProposalsResponse> {
  const response = await api.get<ProposalsResponse>(
    `/proposals/processes/${processId}/proposals`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Cria uma nova proposta de negociação
 * @param data - Dados da proposta
 * @returns Proposta criada
 */
export async function createProposal(
  data: CreateProposalRequest
): Promise<{ success: boolean; message: string; data: NegotiationProposal }> {
  const response = await api.post<{
    success: boolean;
    message: string;
    data: NegotiationProposal;
  }>("/proposals", data, { withCredentials: true });
  return response.data;
}

/**
 * Aceita uma proposta
 * @param proposalId - ID da proposta
 * @param message - Mensagem opcional
 * @returns Proposta atualizada
 */
export async function acceptProposal(
  proposalId: string,
  message?: string
): Promise<{ success: boolean; message: string; data: NegotiationProposal }> {
  const response = await api.patch<{
    success: boolean;
    message: string;
    data: NegotiationProposal;
  }>(`/proposals/${proposalId}/accept`, { message }, { withCredentials: true });
  return response.data;
}

/**
 * Rejeita uma proposta
 * @param proposalId - ID da proposta
 * @param message - Mensagem opcional (motivo da rejeição)
 * @returns Proposta atualizada
 */
export async function rejectProposal(
  proposalId: string,
  message?: string
): Promise<{ success: boolean; message: string; data: NegotiationProposal }> {
  const response = await api.patch<{
    success: boolean;
    message: string;
    data: NegotiationProposal;
  }>(`/proposals/${proposalId}/reject`, { message }, { withCredentials: true });
  return response.data;
}

/**
 * Obtém uma proposta específica
 * @param proposalId - ID da proposta
 * @returns Proposta
 */
export async function getProposalById(
  proposalId: string
): Promise<{ success: boolean; message: string; data: NegotiationProposal }> {
  const response = await api.get<{
    success: boolean;
    message: string;
    data: NegotiationProposal;
  }>(`/proposals/${proposalId}`, { withCredentials: true });
  return response.data;
}
