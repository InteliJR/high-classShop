import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { importAdminCatalogCsv } from "./admin-specialist-journey.service";

vi.mock("./api", () => ({
  default: { post: vi.fn() },
}));

describe("admin specialist CSV synchronization", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, message: "ok" },
    });
  });

  it("envia o token exato da prévia ao confirmar SYNCHRONIZE", async () => {
    const file = new File(["csv"], "catalog.csv", { type: "text/csv" });

    await importAdminCatalogCsv(
      "CAR",
      "00000000-0000-4000-8000-000000000001",
      file,
      "SYNCHRONIZE",
      true,
      "signed-preview-token",
    );

    const form = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(form.get("synchronize_preview_token")).toBe(
      "signed-preview-token",
    );
  });
});
