import api from "./api";

export interface CsvErrorRow {
  row: number;
  reason: string;
  fields?: Record<string, any>;
  imageWarnings?: string[];
}

export interface CsvImportResponse {
  success: boolean;
  message: string;
  insertedCount: number;
  updatedCount: number;
  errorCount: number;
  warningCount: number;
  errorRows: CsvErrorRow[];
  warningRows: CsvErrorRow[];
  insertedIds?: number[];
  updatedIds?: number[];
}

export interface ImportJobAcceptedResponse {
  jobId: string;
  status: string;
  productType: string;
  totalItems: number;
  pollIntervalMs: number;
  message: string;
}

export interface ImportJobStatusResponse {
  jobId: string;
  status: string;
  productType: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  warningItems: number;
  failedItems: number;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  done: boolean;
  result: CsvImportResponse;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getImportJobStatus(
  jobId: string,
): Promise<ImportJobStatusResponse> {
  const response = await api.get<ImportJobStatusResponse>(
    `/product-import-jobs/${jobId}`,
  );
  return response.data;
}

export async function waitImportJobCompletion(
  jobId: string,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CsvImportResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getImportJobStatus(jobId);

    if (status.done) {
      return status.result;
    }

    await wait(pollIntervalMs);
  }

  throw new Error("Tempo limite atingido ao aguardar conclusão da importação");
}

export async function resolveImportResponse(
  response: CsvImportResponse | ImportJobAcceptedResponse,
): Promise<CsvImportResponse> {
  if ((response as ImportJobAcceptedResponse).jobId) {
    const accepted = response as ImportJobAcceptedResponse;
    return waitImportJobCompletion(
      accepted.jobId,
      accepted.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
    );
  }

  return response as CsvImportResponse;
}
