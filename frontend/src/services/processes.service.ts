import api from "./api";

export interface Process {
  id: string;
  status:
    | "SCHEDULING"
    | "NEGOTIATION"
    | "PROCESSING_CONTRACT"
    | "DOCUMENTATION"
    | "COMPLETED"
    | "REJECTED";
  appointment_status?:
    | "PENDING"
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED"
    | null;
  appointment_datetime?: string | null;
  product_type?: "CAR" | "BOAT" | "AIRCRAFT" | null;
  client_id: string;
  specialist_id: string;
  product_id?: number | string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
  client?: {
    id: string;
    email?: string;
    name?: string;
  };
  product?: {
    id: number | string;
    marca?: string;
    modelo?: string;
    descricao?: string;
    ano?: number;
    estado?: string;
  } | null;
  specialist?: {
    id: string;
    name?: string;
    especialidade?: string;
  };
  // Flag para identificar consultoria (sem produto ainda)
  isConsultancy?: boolean;
}

export interface MeetingSession {
  id: string;
  process_id: string;
  meet_link: string;
  started_at: string;
  ended_at?: string | null;
  is_active?: boolean;
}

export interface ConversationDoneResult {
  meeting: MeetingSession;
  alreadyEnded: boolean;
  processTransition: {
    advanced: boolean;
    previous_status: Process["status"];
    status: Process["status"];
    requires_product_selection: boolean;
    message: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ProcessFilters {
  status?: string;
  search?: string;
  sortBy?: "created_at" | "updated_at" | "status";
  order?: "asc" | "desc";
}

/**
 * Get all processes
 * Filters based on user role and permissions
 */
export async function getProcesses(page = 1, perPage = 20): Promise<Process[]> {
  const response = await api.get<ApiResponse<Process[]>>("/processes", {
    withCredentials: true,
    params: { page, perPage },
  });
  return response.data.data;
}

/**
 * Get all processes created by a specific specialist
 * @param specialistId - The ID of the specialist
 * @param page - Page number
 * @param perPage - Items per page
 * @param filters - Optional filters (status, search, sortBy, order)
 */
export async function getProcessesBySpecialist(
  specialistId: string,
  page = 1,
  perPage = 20,
  filters?: ProcessFilters,
): Promise<Process[]> {
  const response = await api.get<ApiResponse<Process[]>>(
    `/processes/specialist/${specialistId}`,
    {
      withCredentials: true,
      params: {
        page,
        perPage,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.search && { search: filters.search }),
        ...(filters?.sortBy && { sortBy: filters.sortBy }),
        ...(filters?.order && { order: filters.order }),
      },
    },
  );
  return response.data.data;
}

/**
 * Get a specific process by ID
 * @param processId - ID of the process to retrieve
 */
export async function getProcessById(processId: string): Promise<Process> {
  const response = await api.get<ApiResponse<Process>>(
    `/processes/${processId}`,
    { withCredentials: true },
  );
  return response.data.data;
}

export interface CreateProcessRequest {
  client_id: string;
  specialist_id: string | undefined;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: string | number;
}

/**
 * Create a new process
 * @param data - Process data
 */
export async function createProcess(
  data: CreateProcessRequest,
): Promise<Process> {
  const response = await api.post<ApiResponse<Process>>("/processes", data, {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Update process status
 * @param processId - ID of the process to update
 * @param status - New status
 * @param notes - Optional notes about the update
 */
export async function updateProcessStatus(
  processId: string,
  status: Process["status"],
  notes?: string,
): Promise<Process> {
  const response = await api.patch<ApiResponse<Process>>(
    `/processes/${processId}/status`,
    { status, notes },
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Atribui um produto a um processo de consultoria
 * Somente o especialista pode atribuir o produto após a reunião
 * O processo avança automaticamente para NEGOTIATION se o agendamento já foi concluído
 * @param processId - ID do processo de consultoria
 * @param productType - Tipo do produto (CAR, BOAT, AIRCRAFT)
 * @param productId - ID do produto
 * @returns O processo atualizado com o produto atribuído
 */
export async function assignProductToProcess(
  processId: string,
  productType: "CAR" | "BOAT" | "AIRCRAFT",
  productId: number,
): Promise<Process> {
  const response = await api.patch<ApiResponse<Process>>(
    `/processes/${processId}/assign-product`,
    { product_type: productType, product_id: productId },
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Verifica se um processo é de consultoria (sem produto atribuído)
 * @param process - O processo a verificar
 * @returns true se for consultoria, false caso contrário
 */
export function isConsultancyProcess(process: Process): boolean {
  return !process.product_type || !process.product_id;
}

/**
 * Get process completion reason
 * @param processId - ID of the process
 */
export async function getProcessCompletionReason(
  processId: string,
): Promise<string | null> {
  const response = await api.get<ApiResponse<{ reason: string | null }>>(
    `/processes/${processId}/completion-reason`,
    { withCredentials: true },
  );
  return response.data.data.reason;
}

/**
 * Get process with active contract data
 * @param processId - ID of the process
 */
export async function getProcessWithActiveContract(
  processId: string,
): Promise<any> {
  const response = await api.get<ApiResponse<any>>(
    `/processes/${processId}/with-contract`,
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Get processes by client ID
 * @param clientId - ID of the client
 * @param page - Page number
 * @param perPage - Items per page
 */
export async function getProcessesByClient(
  clientId: string,
  page = 1,
  perPage = 20,
): Promise<Process[]> {
  const response = await api.get<ApiResponse<Process[]>>(
    `/processes/client/${clientId}`,
    {
      withCredentials: true,
      params: { page, perPage },
    },
  );
  return response.data.data;
}

/**
 * Reject a process with optional reason
 * @param processId - ID of the process to reject
 * @param rejectionReason - Optional reason for rejection
 */
export async function rejectProcess(
  processId: string,
  rejectionReason?: string,
): Promise<Process> {
  const response = await api.patch<ApiResponse<Process>>(
    `/processes/${processId}/reject`,
    { rejection_reason: rejectionReason },
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Confirm appointment for a process in SCHEDULING status
 * Moves process to NEGOTIATION and updates appointment to SCHEDULED
 * @param processId - ID of the process
 */
export async function confirmAppointment(
  processId: string,
): Promise<{ processId: string; status: string }> {
  const response = await api.post<ApiResponse<any>>(
    `/processes/${processId}/confirm-appointment`,
    {},
    { withCredentials: true },
  );
  return response.data.data;
}

/**
 * Cancel appointment for a process in SCHEDULING status
 * Deletes both the appointment and the process
 * @param processId - ID of the process
 */
export async function cancelAppointment(
  processId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<ApiResponse<any>>(
    `/processes/${processId}/cancel-appointment`,
    {},
    { withCredentials: true },
  );
  return response.data.data;
}

export interface CreateAppointmentRequest {
  specialist_id: string;
  client_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: string | number;
  scheduled_date?: string;
  notes?: string;
}

/**
 * Create an appointment confirmation (Calendly integration)
 * @param data - Appointment data from Calendly
 */
export async function createAppointment(
  data: CreateAppointmentRequest,
): Promise<any> {
  const response = await api.post<ApiResponse<any>>("/appointments", data, {
    withCredentials: true,
  });
  return response.data.data;
}

export async function getMeetingByProcess(
  processId: string,
): Promise<MeetingSession | null> {
  const response = await api.get<ApiResponse<MeetingSession | null>>(
    `/meetings/process/${processId}`,
    { withCredentials: true },
  );

  return response.data.data;
}

export async function startMeeting(
  processId: string,
  options?: { isAdvanced?: boolean },
): Promise<MeetingSession> {
  const response = await api.post<ApiResponse<MeetingSession>>(
    `/meetings/process/${processId}/start`,
    { isAdvanced: options?.isAdvanced ?? false },
    { withCredentials: true },
  );

  return response.data.data;
}

export async function endMeeting(processId: string): Promise<{
  meeting: MeetingSession;
  alreadyEnded: boolean;
  message: string;
}> {
  const response = await api.post<
    ApiResponse<{
      meeting: MeetingSession;
      alreadyEnded: boolean;
      message: string;
    }>
  >(`/meetings/process/${processId}/end`, {}, { withCredentials: true });

  return response.data.data;
}

export async function markConversationDone(
  processId: string,
): Promise<ConversationDoneResult> {
  const response = await api.post<ApiResponse<ConversationDoneResult>>(
    `/meetings/process/${processId}/conversation-done`,
    {},
    { withCredentials: true },
  );

  return response.data.data;
}
