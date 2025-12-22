import api from "./api";

export interface CreateContractData {
  file: File;
  client_email: string;
  process_id: string;
  description?: string;
}

export interface ContractResponse {
  id: string;
  process_id: string;
  client_email: string;
  file_path: string;
  status: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Create a new contract by uploading a PDF file
 * @param data - Contract data including file and metadata
 * @returns Contract response with details
 */
export async function createContract(
  data: CreateContractData
): Promise<ContractResponse> {
  const formData = new FormData();

  // Append file
  formData.append("file", data.file);

  // Append metadata fields
  formData.append("client_email", data.client_email);
  formData.append("process_id", data.process_id);
  if (data.description) {
    formData.append("description", data.description);
  }

  const response = await api.post<ApiResponse<ContractResponse>>(
    "/contracts",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      withCredentials: true,
    }
  );

  return response.data.data;
}

/**
 * Get contract by ID
 * @param contractId - ID of the contract to retrieve
 */
export async function getContract(
  contractId: string
): Promise<ContractResponse> {
  const response = await api.get<ApiResponse<ContractResponse>>(
    `/contracts/${contractId}`,
    { withCredentials: true }
  );
  return response.data.data;
}

/**
 * List all contracts (admin/specialist only)
 */
export async function listContracts(): Promise<ContractResponse[]> {
  const response = await api.get<ApiResponse<ContractResponse[]>>(
    "/contracts",
    { withCredentials: true }
  );
  return response.data.data;
}
