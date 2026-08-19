import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockerMessage,
  changeRole,
  changeSpeciality,
  getDialogRequirements,
  roleLabel,
  specialityLabel,
  validateRoleChange,
  validateSpecialityChange,
} from "./admin-user-management";
import api from "../services/api";

vi.mock("../services/api", () => ({
  default: {
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

describe("admin-user-management", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it("localiza enums", () => {
    expect(roleLabel("OFFICE")).toBe("Gerente de escritório");
    expect(specialityLabel("AIRCRAFT")).toBe("Aeronaves");
  });

  it("não expõe enum em bloqueio", () => {
    const text = blockerMessage({
      code: "SPECIALIST_HAS_ACTIVE_PRODUCTS",
      count: 2,
    });

    expect(text).toContain("2 produtos ativos");
    expect(text).not.toMatch(/SPECIALIST|PRODUCTS|CAR|BOAT|AIRCRAFT/);
  });

  it("pede contexto do destino", () => {
    expect(getDialogRequirements("CONSULTANT")).toEqual(["company"]);
    expect(getDialogRequirements("SPECIALIST")).toEqual(["speciality"]);
    expect(getDialogRequirements("ADMIN")).toEqual([]);
  });

  it("usa Não informado para enum ausente ou desconhecido", () => {
    expect(roleLabel()).toBe("Não informado");
    expect(specialityLabel("OUTRO")).toBe("Não informado");
  });

  it("valida e aplica a alteração de cargo nas rotas protegidas", async () => {
    const payload = { role: "CONSULTANT" as const, company_id: "company-1" };
    vi.mocked(api.post).mockResolvedValueOnce({ data: { allowed: true } });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { id: "user-1" } });

    await expect(validateRoleChange("user-1", payload)).resolves.toEqual({
      allowed: true,
    });
    await expect(changeRole("user-1", payload)).resolves.toEqual({ id: "user-1" });

    expect(api.post).toHaveBeenCalledWith(
      "admin/database/users/user-1/role-change/validate",
      payload,
    );
    expect(api.patch).toHaveBeenCalledWith(
      "admin/database/users/user-1/role-change",
      payload,
    );
  });

  it("valida e aplica a alteração de especialidade nas rotas protegidas", async () => {
    const payload = { speciality: "BOAT" as const };
    vi.mocked(api.post).mockResolvedValueOnce({ data: { allowed: true } });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { id: "user-1" } });

    await expect(validateSpecialityChange("user-1", payload)).resolves.toEqual({
      allowed: true,
    });
    await expect(changeSpeciality("user-1", payload)).resolves.toEqual({ id: "user-1" });

    expect(api.post).toHaveBeenCalledWith(
      "admin/database/users/user-1/speciality-change/validate",
      payload,
    );
    expect(api.patch).toHaveBeenCalledWith(
      "admin/database/users/user-1/speciality-change",
      payload,
    );
  });

  it("normaliza falhas inesperadas das alterações", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error("network exploded"));

    await expect(changeSpeciality("user-1", { speciality: "CAR" })).rejects.toThrow(
      "Não foi possível concluir a alteração. Tente novamente.",
    );
  });
});
