import {
  getCalendlySyncStatus,
  registerCalendlyScheduledEvent,
  type CalendlySyncStatus,
  type RegisterCalendlyScheduledPayload,
} from "./appointments.service";

export const CALENDLY_SYNC_MAX_ATTEMPTS = 8;
export const CALENDLY_SYNC_BASE_DELAY_MS = 500;
const CALENDLY_SYNC_MAX_DELAY_MS = 3500;

export function isCalendlySyncComplete(status: CalendlySyncStatus): boolean {
  return (
    status.calendly_sync_status === "SYNCED" &&
    Boolean(status.appointment_datetime) &&
    status.status !== "CANCELLED"
  );
}

function isTerminal(status: CalendlySyncStatus): boolean {
  return (
    status.calendly_sync_status === "FAILED" || status.status === "CANCELLED"
  );
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    function finish(completed: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      resolve(completed);
    }
    function abort() {
      finish(false);
    }
    const timeout = setTimeout(() => finish(true), delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function synchronizeCalendlyRegistration(
  appointmentId: string,
  payload: RegisterCalendlyScheduledPayload,
  options: {
    signal?: AbortSignal;
    maxAttempts?: number;
  } = {},
): Promise<CalendlySyncStatus | null> {
  const maxAttempts = options.maxAttempts ?? CALENDLY_SYNC_MAX_ATTEMPTS;
  let lastStatus: CalendlySyncStatus | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) return null;

    try {
      await registerCalendlyScheduledEvent(appointmentId, payload);
    } catch (error) {
      lastError = error;
    }
    if (options.signal?.aborted) return null;

    try {
      lastStatus = await getCalendlySyncStatus(appointmentId);
      if (isCalendlySyncComplete(lastStatus) || isTerminal(lastStatus)) {
        return lastStatus;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt === maxAttempts - 1) break;
    const delayMs = Math.min(
      CALENDLY_SYNC_BASE_DELAY_MS * 2 ** attempt,
      CALENDLY_SYNC_MAX_DELAY_MS,
    );
    if (!(await waitForRetry(delayMs, options.signal))) return null;
  }

  if (lastStatus) return lastStatus;
  throw lastError ?? new Error("Não foi possível sincronizar o Calendly");
}
