// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearContractOperationId,
  getOrCreateContractOperationId,
} from "./contract-operation-id";

describe("contract operation id lifecycle", () => {
  beforeEach(() => sessionStorage.clear());

  it("survives remount/reload for the same process", () => {
    const first = getOrCreateContractOperationId("process-1");
    expect(getOrCreateContractOperationId("process-1")).toBe(first);
  });

  it("uses an independent scope when the process changes", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    expect(getOrCreateContractOperationId("process-1")).not.toBe(
      getOrCreateContractOperationId("process-2"),
    );
  });

  it("rotates only after an explicit resolution clears the current key", () => {
    const first = getOrCreateContractOperationId("process-1");
    clearContractOperationId("process-1", "another-operation");
    expect(getOrCreateContractOperationId("process-1")).toBe(first);
    clearContractOperationId("process-1", first);
    expect(getOrCreateContractOperationId("process-1")).not.toBe(first);
  });
});
