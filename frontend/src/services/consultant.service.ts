// frontend/src/services/consultant.service.ts

import api from "./api";
import type { UserProps } from "../types/types";

// Client is just a User with role CUSTOMER linked to a consultant
export type Client = UserProps;

export type InviteClientData = {
  email: string;
};

export type UpdateClientData = Partial<Pick<UserProps, 'name' | 'surname' | 'email' | 'civil_state'>>;

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type InviteResponseData = {
  email: string;
  registrationLink?: string;
  warning?: string;
  messageId?: string;
};

export type InviteResponse = ApiResponse<InviteResponseData>;

/**
 * Get all clients for the authenticated consultant
 * Uses JWT authentication via api interceptor
 */
export async function getClients(): Promise<Client[]> {
  const response = await api.get<ApiResponse<Client[]>>('/consultant/clients', {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Send an invitation email to a potential client
 * @param email - Email address of the potential client
 * @returns Invitation response with invite link
 */
export async function inviteClient(email: string): Promise<InviteResponseData> {
  const response = await api.post<InviteResponse>(
    '/consultant/invite',
    { email },
    { withCredentials: true }
  );
  return response.data.data;
}

/**
 * Update an existing client
 * @param clientId - ID of the client to update
 * @param data - Client data to update
 */
export async function updateClient(
  clientId: string,
  data: UpdateClientData
): Promise<Client> {
  const response = await api.put<ApiResponse<Client>>(
    `/consultant/clients/${clientId}`,
    data,
    { withCredentials: true }
  );
  return response.data.data;
}

/**
 * Remove a client (unlink from consultant)
 * @param clientId - ID of the client to remove
 */
export async function removeClient(clientId: string): Promise<void> {
  await api.delete(`/consultant/clients/${clientId}`, {
    withCredentials: true,
  });
}

export type CreateConsultantProcessData = {
  client_id: string;
  specialist_id: string;
  product_type: 'CAR' | 'BOAT' | 'AIRCRAFT';
  product_id?: number;
};

/**
 * Create a process on behalf of a client
 */
export async function createConsultantProcess(data: CreateConsultantProcessData): Promise<unknown> {
  const response = await api.post<ApiResponse<unknown>>('/consultant/processes', data, {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Get all processes for a specific client
 */
export async function getClientProcesses(clientId: string): Promise<unknown[]> {
  const response = await api.get<ApiResponse<unknown[]>>(
    `/consultant/clients/${clientId}/processes`,
    { withCredentials: true },
  );
  return response.data.data;
}

export type ConsultantProcess = {
  id: string;
  status: string;
  product_type: string | null;
  created_at: string;
  client_id: string;
  client: { id: string; name: string; surname: string } | null;
  specialist: { id: string; name: string; surname: string; speciality: string } | null;
};

/**
 * Get all processes across all clients of the consultant, with optional filters
 */
export async function getAllConsultantProcesses(
  filters: { status?: string; clientId?: string } = {},
): Promise<ConsultantProcess[]> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.clientId) params.clientId = filters.clientId;

  const response = await api.get<ApiResponse<ConsultantProcess[]>>(
    '/consultant/processes',
    { withCredentials: true, params },
  );
  return response.data.data;
}

/**
 * Validate a consultant invite token
 */
export async function validateConsultantInvite(token: string): Promise<{
  companyId: string;
  companyName: string;
  email: string;
}> {
  const response = await api.post('/auth/validate-consultant-invite', { token });
  return response.data.data;
}

/**
 * Register a new consultant via invite token
 */
export async function registerConsultant(data: {
  invite_token: string;
  name: string;
  surname: string;
  cpf: string;
  rg: string;
  password: string;
}): Promise<unknown> {
  const response = await api.post('/auth/register-consultant', data);
  return response.data;
}

