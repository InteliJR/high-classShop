import api from "./api";

export interface Appointment {
  id: string;
  client_id: string;
  specialist_id: string;
  product_type?: "CAR" | "BOAT" | "AIRCRAFT" | null;
  product_id?: number | null;
  appointment_datetime?: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string;
  created_at: string;
  updated_at: string;
  user_clicked_at?: string;
  pending_expires_at?: string;
  confirmed_at?: string;
  confirmed_by_id?: string;
  calendly_event_uri?: string | null;
  calendly_invitee_uri?: string | null;
  calendly_scheduled_at?: string | null;
  calendly_last_sync_at?: string | null;
  calendly_sync_status?: "PENDING" | "SYNCED" | "FAILED";
  client?: {
    id: string;
    name: string;
    surname: string;
    email: string;
  };
  specialist?: {
    id: string;
    name: string;
    surname: string;
    calendly_url?: string;
  };
  product?: {
    id: number;
    product_type: string;
    marca: string;
    modelo: string;
    valor: number;
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RegisterCalendlyScheduledPayload {
  event_uri: string;
  invitee_uri: string;
  client_event?: "calendly.event_scheduled";
  client_observed_at?: string;
  scheduled_start_time?: string;
}

export interface CalendlySyncStatus {
  appointment_id: string;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  calendly_sync_status: "PENDING" | "SYNCED" | "FAILED";
  appointment_datetime: string | null;
  calendly_last_sync_at: string | null;
}

export interface CalendlyOAuthStatus {
  connected: boolean;
  calendly_user_uri: string | null;
  expires_at: string | null;
  is_active: boolean;
}

/**
 * Verifica se existe um agendamento entre cliente e especialista para um produto específico
 * @param clientId - ID do cliente
 * @param specialistId - ID do especialista
 * @param productType - Tipo do produto (CAR, BOAT, AIRCRAFT)
 * @param productId - ID do produto
 * @returns true se existe agendamento ativo, false caso contrário
 */
export async function checkExistingAppointment(
  clientId: string,
  specialistId: string,
  productType: "CAR" | "BOAT" | "AIRCRAFT",
  productId: number,
): Promise<Appointment | null> {
  try {
    const response = await api.get<ApiResponse<Appointment | null>>(
      `/appointments/check`,
      {
        withCredentials: true,
        params: {
          client_id: clientId,
          specialist_id: specialistId,
          product_type: productType,
          product_id: productId,
        },
      },
    );
    return response.data.data;
  } catch (error) {
    console.error("Erro ao verificar agendamento:", error);
    return null;
  }
}

/**
 * Cria um agendamento PENDING (cliente clicou no link do Calendly)
 * @param data - Dados do agendamento
 * @returns O agendamento criado em status PENDING
 */
export async function createPendingAppointment(data: {
  client_id: string;
  specialist_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: number;
  notes?: string;
}): Promise<Appointment> {
  const response = await api.post<ApiResponse<Appointment>>(
    "/appointments/pending",
    data,
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Cria um agendamento de consultoria PENDING (sem produto definido)
 * O especialista irá recomendar um produto durante a reunião
 * @param data - Dados do agendamento de consultoria
 * @returns O agendamento de consultoria criado em status PENDING
 */
export async function createConsultancyAppointment(data: {
  client_id: string;
  specialist_id: string;
  notes?: string;
}): Promise<Appointment> {
  const response = await api.post<ApiResponse<Appointment>>(
    "/appointments/pending",
    {
      ...data,
      // Não envia product_type e product_id para consultoria
    },
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Lista agendamentos PENDING do especialista autenticado
 * @param page - Número da página
 * @param limit - Itens por página
 * @returns Lista de agendamentos PENDING
 */
export async function getPendingAppointments(
  page: number = 1,
  limit: number = 20,
): Promise<{ data: Appointment[]; total: number }> {
  const response = await api.get<{
    success: boolean;
    data: Appointment[];
    meta: { total: number };
  }>("/appointments/pending", {
    withCredentials: true,
    params: { page, limit },
  });
  return {
    data: response.data.data,
    total: response.data.meta.total,
  };
}

/**
 * Confirma um agendamento PENDING (especialista confirma)
 * @param appointmentId - ID do agendamento
 * @param appointmentDatetime - Data/hora opcional do agendamento
 * @returns O agendamento confirmado em status SCHEDULED
 */
export async function confirmPendingAppointment(
  appointmentId: string,
  appointmentDatetime?: string,
): Promise<Appointment> {
  const response = await api.post<ApiResponse<Appointment>>(
    `/appointments/pending/${appointmentId}/confirm`,
    { appointment_datetime: appointmentDatetime },
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Cancela um agendamento PENDING
 * @param appointmentId - ID do agendamento
 * @returns O agendamento cancelado
 */
export async function cancelPendingAppointment(
  appointmentId: string,
): Promise<Appointment> {
  const response = await api.post<ApiResponse<Appointment>>(
    `/appointments/pending/${appointmentId}/cancel`,
    {},
    { withCredentials: true },
  );
  return response.data.data;
}

export async function registerCalendlyScheduledEvent(
  appointmentId: string,
  payload: RegisterCalendlyScheduledPayload,
): Promise<{
  appointment_id: string;
  calendly_sync_status: "PENDING" | "SYNCED" | "FAILED";
  appointment_datetime: string | null;
}> {
  const response = await api.post<
    ApiResponse<{
      appointment_id: string;
      calendly_sync_status: "PENDING" | "SYNCED" | "FAILED";
      appointment_datetime: string | null;
    }>
  >(`/appointments/pending/${appointmentId}/calendly-scheduled`, payload, {
    withCredentials: true,
  });

  return response.data.data;
}

export async function getCalendlySyncStatus(
  appointmentId: string,
): Promise<CalendlySyncStatus> {
  const response = await api.get<ApiResponse<CalendlySyncStatus>>(
    `/appointments/${appointmentId}/calendly-sync-status`,
    { withCredentials: true },
  );

  return response.data.data;
}

export async function getCalendlyAuthorizeUrl(): Promise<string> {
  const response = await api.get<ApiResponse<{ authorize_url: string }>>(
    "/appointments/calendly/oauth/authorize",
    { withCredentials: true },
  );

  return response.data.data.authorize_url;
}

export async function getCalendlyOAuthStatus(): Promise<CalendlyOAuthStatus> {
  const response = await api.get<ApiResponse<CalendlyOAuthStatus>>(
    "/appointments/calendly/oauth/status",
    { withCredentials: true },
  );

  return response.data.data;
}

export async function disconnectCalendlyOAuth(): Promise<void> {
  await api.post(
    "/appointments/calendly/oauth/disconnect",
    {},
    { withCredentials: true },
  );
}

/**
 * Lista agendamentos do usuário autenticado
 * @param page - Número da página
 * @param limit - Itens por página
 * @returns Lista de agendamentos com paginação
 */
export async function getMyAppointments(
  page: number = 1,
  limit: number = 20,
): Promise<Appointment[]> {
  try {
    const response = await api.get<ApiResponse<Appointment[]>>(
      "/appointments",
      {
        withCredentials: true,
        params: { page, limit },
      },
    );
    return response.data.data;
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return [];
  }
}
