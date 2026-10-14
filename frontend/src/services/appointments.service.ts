import api from "./api";
import type { ProductCurrency } from "../types/types";
import { parseAppointmentIso } from "../lib/appointment-datetime";

export type AppointmentSchedulingMethod = "CALENDLY" | "EMAIL" | "PLATFORM";

export interface Appointment {
  id: string;
  client_id: string;
  specialist_id: string;
  product_type?: "CAR" | "BOAT" | "AIRCRAFT" | null;
  product_id?: string | null;
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
  scheduling_method?: AppointmentSchedulingMethod | null;
  specialist_rescheduled_at?: string | null;
  specialist_rescheduled_from?: string | null;
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
    id: string;
    product_type: string;
    marca: string;
    modelo: string;
    valor: number;
    currency: ProductCurrency;
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type ExistingAppointmentCheck =
  | { exists: false }
  | {
      exists: true;
      appointment_id: string;
      process_id: string;
      appointment_status: Appointment["status"];
      scheduling_method: AppointmentSchedulingMethod | null;
      appointment_datetime: string | null;
    };

export interface ActiveProcessSnapshot {
  process_id: string;
  appointment_id: string | null;
  appointment_status: Appointment["status"] | null;
  scheduling_method: AppointmentSchedulingMethod | null;
  appointment_datetime: string | null;
}

interface BaseProductRequest {
  client_id: string;
  specialist_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: string;
  notes?: string;
}

export type ProductPendingAppointmentInput =
  | (BaseProductRequest & { scheduling_method: "EMAIL"; appointment_datetime: string })
  | (BaseProductRequest & { scheduling_method: "CALENDLY"; appointment_datetime?: never });

export type PendingAppointmentCreated = Appointment & { process_id: string };

/** Only the backend's dedicated owned-duplicate response can recover an active request. */
export function getActiveProcessSnapshot(error: unknown): ActiveProcessSnapshot | null {
  const record = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  const response = record(record(error)?.response);
  const payload = record(record(response?.data)?.error);
  if (response?.status !== 409 || payload?.code !== "ACTIVE_PROCESS_EXISTS") return null;
  const snapshot = record(record(payload.details)?.existing_request);
  if (!snapshot || typeof snapshot.process_id !== "string" || !snapshot.process_id
    || !(snapshot.appointment_id === null || typeof snapshot.appointment_id === "string")
    || !(snapshot.appointment_datetime === null || typeof snapshot.appointment_datetime === "string")
    || !(snapshot.appointment_status === null || ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"].includes(snapshot.appointment_status as string))
    || !(snapshot.scheduling_method === null || ["EMAIL", "CALENDLY", "PLATFORM"].includes(snapshot.scheduling_method as string))) return null;
  return {
    process_id: snapshot.process_id,
    appointment_id: snapshot.appointment_id as string | null,
    appointment_status: snapshot.appointment_status as ActiveProcessSnapshot["appointment_status"],
    scheduling_method: snapshot.scheduling_method as ActiveProcessSnapshot["scheduling_method"],
    appointment_datetime: snapshot.appointment_datetime as string | null,
  };
}

export interface RegisterCalendlyScheduledPayload {
  event_uri: string;
  invitee_uri: string;
  client_event?: "calendly.event_scheduled";
  client_observed_at?: string;
}

export interface CalendlyRegistrationStatus {
  appointment_id: string;
  calendly_sync_status: "PENDING" | "SYNCED" | "FAILED";
  appointment_datetime: string | null;
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
  last_error?: string | null;
}

/**
 * Consulta o próprio pedido; a identidade do cliente vem exclusivamente do JWT.
 */
export async function checkExistingAppointment(
  specialistId: string,
  productType: "CAR" | "BOAT" | "AIRCRAFT",
  productId: string,
): Promise<ExistingAppointmentCheck> {
  const response = await api.get<ApiResponse<ExistingAppointmentCheck>>(
    "/appointments/check",
    {
      withCredentials: true,
      params: {
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
      },
    },
  );
  return response.data.data;
}

/**
 * Cria um pedido PENDING por e-mail com data proposta ou pelo Calendly sem data do cliente.
 * @param data - Dados do agendamento
 * @returns O agendamento criado em status PENDING
 */
export async function createPendingAppointment(data: ProductPendingAppointmentInput): Promise<PendingAppointmentCreated> {
  if (data.scheduling_method === "CALENDLY" && data.appointment_datetime !== undefined) {
    throw new Error("O horário Calendly é definido pela integração");
  }
  if (data.scheduling_method === "EMAIL") {
    const parsed = parseAppointmentIso(data.appointment_datetime);
    if (parsed.getTime() <= Date.now()) throw new Error("Selecione uma data e hora futuras");
  }
  const response = await api.post<ApiResponse<PendingAppointmentCreated>>(
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
  scheduling_method: "CALENDLY" | "EMAIL";
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

export async function createPlatformAppointment(data: {
  client_id: string;
  specialist_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: string;
  appointment_datetime: string;
  notes?: string;
}): Promise<Appointment> {
  const response = await api.post<ApiResponse<Appointment>>(
    "/appointments",
    data,
    { withCredentials: true },
  );
  return response.data.data;
}

export async function rescheduleAppointment(
  appointmentId: string,
  appointmentDatetime: string,
): Promise<Appointment> {
  const response = await api.patch<ApiResponse<Appointment>>(
    `/appointments/${appointmentId}/reschedule`,
    { appointment_datetime: appointmentDatetime },
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
): Promise<CalendlyRegistrationStatus> {
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
