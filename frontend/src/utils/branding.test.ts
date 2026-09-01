import { describe, expect, it } from "vitest";
import type { CompanyBranding, UserProps } from "../types/types";
import { getActiveCompany } from "./branding";

function company(id: string): CompanyBranding {
  return { id, name: `Empresa ${id}` };
}

function userWithCompany(value: CompanyBranding | null): UserProps {
  return {
    id: "user-1",
    name: "Usuário",
    surname: "Teste",
    email: "usuario@example.com",
    cpf: "00000000000",
    rg: "000000000",
    role: "OFFICE",
    company: value,
  };
}

describe("getActiveCompany", () => {
  it("prioriza a empresa do usuário sobre o white-label em memória", () => {
    const authenticatedCompany = company("authenticated");

    expect(
      getActiveCompany(
        userWithCompany(authenticatedCompany),
        company("whitelabel"),
      ),
    ).toBe(authenticatedCompany);
  });

  it("usa a empresa white-label quando não há usuário", () => {
    const whitelabelCompany = company("whitelabel");

    expect(getActiveCompany(null, whitelabelCompany)).toBe(whitelabelCompany);
  });

  it("retorna null sem empresa autenticada ou white-label", () => {
    expect(getActiveCompany(null, null)).toBeNull();
  });
});
