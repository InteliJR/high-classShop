import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockerMessage,
  ChangeValidationError,
  changeRole,
  changeSpeciality,
  createLatestRequestGuard,
  getManagementDialogInteractionPolicy,
  getDialogRequirements,
  isSameRecordsOrigin,
  roleLabel,
  specialityLabel,
  shouldInvalidateRecordsRequest,
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

  it("flexiona bloqueios contáveis no singular e no plural", () => {
    expect(
      blockerMessage({ code: "CONSULTANT_HAS_CLIENTS", count: 1 }),
    ).toBe("O consultor ainda possui 1 cliente vinculado.");
    expect(
      blockerMessage({ code: "SPECIALIST_HAS_OPEN_PROCESSES", count: 2 }),
    ).toBe("O especialista ainda possui 2 processos em andamento.");
  });

  it("pede contexto do destino", () => {
    expect(getDialogRequirements("CONSULTANT")).toEqual(["company"]);
    expect(getDialogRequirements("SPECIALIST")).toEqual(["speciality"]);
    expect(getDialogRequirements("ADMIN")).toEqual([]);
  });

  it("pede substituição quando escritório já tem gerente", () => {
    expect(getDialogRequirements("OFFICE", true)).toEqual([
      "company",
      "replacement",
    ]);
    expect(getDialogRequirements("OFFICE", false)).toEqual(["company"]);
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

  it("aceita somente a resposta da requisição mais recente", () => {
    const guard = createLatestRequestGuard();
    const firstRequest = guard.begin();
    const secondRequest = guard.begin();

    expect(guard.isCurrent(firstRequest)).toBe(false);
    expect(guard.isCurrent(secondRequest)).toBe(true);

    guard.invalidate();

    expect(guard.isCurrent(secondRequest)).toBe(false);
  });

  it("bloqueia edição e fechamento do diálogo enquanto o PATCH está em andamento", () => {
    expect(getManagementDialogInteractionPolicy(true)).toEqual({
      controlsDisabled: true,
      dismissalAllowed: false,
    });
    expect(getManagementDialogInteractionPolicy(false)).toEqual({
      controlsDisabled: false,
      dismissalAllowed: true,
    });
  });

  it("associa registros somente à entidade e página que os originaram", () => {
    const usersPage = { entity: "users", page: 1 };

    expect(isSameRecordsOrigin(usersPage, { entity: "users", page: 1 })).toBe(
      true,
    );
    expect(isSameRecordsOrigin(usersPage, { entity: "companies", page: 1 })).toBe(
      false,
    );
    expect(isSameRecordsOrigin(usersPage, { entity: "users", page: 2 })).toBe(
      false,
    );
  });

  it("não invalida a carga atual quando a seleção de aba e página é um no-op", () => {
    const guard = createLatestRequestGuard();
    const requestId = guard.begin();
    const currentOrigin = { entity: "users", page: 1 };

    if (
      shouldInvalidateRecordsRequest(currentOrigin, {
        entity: "users",
        page: 1,
      })
    ) {
      guard.invalidate();
    }

    expect(guard.isCurrent(requestId)).toBe(true);
    expect(
      shouldInvalidateRecordsRequest(currentOrigin, {
        entity: "companies",
        page: 1,
      }),
    ).toBe(true);
    expect(
      shouldInvalidateRecordsRequest(
        { entity: "users", page: 2 },
        { entity: "users", page: 1 },
      ),
    ).toBe(true);
  });

  it("preserva a revalidação estruturada devolvida pelo PATCH em conflito", async () => {
    const validation = {
      allowed: false,
      summary: "A alteração não pode ser concluída.",
      blockers: [
        {
          code: "OFFICE_CONFLICT" as const,
          message: "O escritório já possui um gerente ativo.",
        },
      ],
    };
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { status: 409, data: validation },
      friendlyMessage: "Conflito: o registro já existe.",
    });

    const caught = await changeRole("user-1", {
      role: "OFFICE",
      company_id: "company-1",
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ChangeValidationError);
    expect(caught).toMatchObject({ validation });
  });
});
