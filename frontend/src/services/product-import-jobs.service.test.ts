import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { waitImportJobCompletion } from "./product-import-jobs.service";

vi.mock("./api", () => ({
  default: { get: vi.fn() },
}));

describe("waitImportJobCompletion", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it("propaga o erro explícito quando o catálogo diverge da prévia", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        jobId: "job-1",
        status: "FAILED",
        productType: "CAR",
        totalItems: 1,
        processedItems: 1,
        successItems: 1,
        warningItems: 0,
        failedItems: 0,
        deactivatedItems: 0,
        reactivatedItems: 0,
        errorMessage:
          "O catálogo mudou desde a prévia. Gere uma nova prévia antes de sincronizar.",
        done: true,
        result: { success: false, message: "Importação falhou." },
      },
    });

    await expect(waitImportJobCompletion("job-1", 0, 100)).rejects.toThrow(
      "O catálogo mudou desde a prévia. Gere uma nova prévia antes de sincronizar.",
    );
  });
});
