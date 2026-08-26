import { describe, expect, it } from "vitest";
import type { UserRole } from "../types/types";
import { getSidebarLinks } from "./navigation";

describe("getSidebarLinks", () => {
  it("oferece catálogo, cadastro e login ao visitante", () => {
    expect(
      getSidebarLinks(null).map(({ to, label }) => ({ to, label })),
    ).toEqual([
      { to: "/catalog/cars", label: "Carros" },
      { to: "/catalog/boats", label: "Embarcações" },
      { to: "/catalog/aircrafts", label: "Aeronaves" },
      { to: "/register", label: "Cadastrar-se" },
      { to: "/login", label: "Login" },
    ]);
  });

  it.each<[UserRole, Array<{ to: string; label: string }>]>([
    [
      "CUSTOMER",
      [
        { to: "/customer/home", label: "Home" },
        { to: "/customer/consultoria", label: "Consultoria" },
        { to: "/customer/processes", label: "Meus Processos" },
        { to: "/catalog/cars", label: "Carros" },
        { to: "/catalog/boats", label: "Embarcações" },
        { to: "/catalog/aircrafts", label: "Aviões" },
      ],
    ],
    [
      "CONSULTANT",
      [
        { to: "/consultant/dashboard", label: "Dashboard" },
        { to: "/consultant/clients", label: "Meus Clientes" },
        { to: "/consultant/processes", label: "Processos" },
        { to: "/catalog/cars", label: "Carros" },
        { to: "/catalog/boats", label: "Embarcações" },
        { to: "/catalog/aircrafts", label: "Aviões" },
      ],
    ],
    [
      "SPECIALIST",
      [
        { to: "/specialist/dashboard", label: "Dashboard" },
        { to: "/specialist/products", label: "Meus produtos" },
        { to: "/specialist/processes", label: "Meus processos" },
      ],
    ],
    [
      "ADMIN",
      [
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/companies", label: "Escritórios" },
        { to: "/office/consultants", label: "Consultores" },
        { to: "/admin/specialists", label: "Especialistas" },
        { to: "/admin/commissions", label: "Comissões" },
        { to: "/admin/calculator", label: "Calculadora" },
        { to: "/admin/database", label: "Base de dados" },
        { to: "/admin/settings", label: "Configurações" },
        { to: "/admin/my-company", label: "Minha Empresa" },
      ],
    ],
    [
      "OFFICE",
      [
        { to: "/office/dashboard", label: "Dashboard" },
        { to: "/office/consultants", label: "Consultores" },
        { to: "/office/clients", label: "Clientes" },
        { to: "/office/processes", label: "Processos" },
        { to: "/office/company", label: "Minha Empresa" },
      ],
    ],
  ])("preserva toda a navegação autenticada de %s", (role, expected) => {
    expect(getSidebarLinks(role).map(({ to, label }) => ({ to, label }))).toEqual(
      expected,
    );
  });

  it("não concede rotas privilegiadas a papel desconhecido", () => {
    expect(getSidebarLinks("UNKNOWN" as UserRole)).toEqual([]);
  });
});
