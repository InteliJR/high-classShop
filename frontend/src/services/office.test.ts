import { describe, it, expect, vi, beforeEach } from "vitest";
import { officeService } from "./office";
import api from "./api";

vi.mock("./api", () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { ok: true } }) },
}));

describe("officeService.inviteConsultant", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockClear();
  });

  it("sem companyId: não manda params (comportamento atual, usado pelo OFFICE)", async () => {
    await officeService.inviteConsultant("a@b.com");
    expect(api.post).toHaveBeenCalledWith(
      "office/consultants/invite",
      { email: "a@b.com" },
      undefined,
    );
  });

  it("com companyId: manda como query param (usado pelo ADMIN)", async () => {
    await officeService.inviteConsultant("a@b.com", "company-123");
    expect(api.post).toHaveBeenCalledWith(
      "office/consultants/invite",
      { email: "a@b.com" },
      { params: { companyId: "company-123" } },
    );
  });
});
