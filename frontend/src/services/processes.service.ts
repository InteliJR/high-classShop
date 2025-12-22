import api from "./api";

export interface Process {
  id: string;
  status: "SCHEDULING" | "NEGOTIATION" | "DOCUMENTATION" | "COMPLETED";
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  client_id: string;
  specialist_id: string;
  product_id: string;
  notes?: string;
  created_at: string;
  updated_at: string;
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
  };
  specialist?: {
    id: string;
    name?: string;
    especialidade?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
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
 */
export async function getProcessesBySpecialist(
  specialistId: string,
  page = 1,
  perPage = 20
): Promise<Process[]> {
  const response = await api.get<ApiResponse<Process[]>>(
    `/processes/specialist/${specialistId}`,
    {
      withCredentials: true,
      params: { page, perPage },
    }
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
    { withCredentials: true }
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
  data: CreateProcessRequest
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
  notes?: string
): Promise<Process> {
  const response = await api.patch<ApiResponse<Process>>(
    `/processes/${processId}/status`,
    { status, notes },
    { withCredentials: true }
  );
  return response.data.data;
}
