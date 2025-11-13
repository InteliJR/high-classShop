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

export type InviteResponse = {
  success: boolean;
  message: string;
  email: string;
  registrationLink?: string;
  warning?: string;
  messageId?: string;
};

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
export async function inviteClient(email: string): Promise<InviteResponse> {
  const response = await api.post<InviteResponse>(
    '/consultant/invite',
    { email },
    { withCredentials: true }
  );
  return response.data;
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

