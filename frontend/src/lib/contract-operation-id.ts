const PREFIX = "contract-preview-operation";

function storageKey(processId: string): string {
  return `${PREFIX}:${processId}`;
}

export function getOrCreateContractOperationId(processId: string): string {
  const key = storageKey(processId);
  const stored = globalThis.sessionStorage?.getItem(key);
  if (stored) return stored;
  const operationId = globalThis.crypto.randomUUID();
  globalThis.sessionStorage?.setItem(key, operationId);
  return operationId;
}

export function clearContractOperationId(
  processId: string,
  expectedOperationId?: string,
): void {
  const key = storageKey(processId);
  if (
    expectedOperationId &&
    globalThis.sessionStorage?.getItem(key) !== expectedOperationId
  ) {
    return;
  }
  globalThis.sessionStorage?.removeItem(key);
}
