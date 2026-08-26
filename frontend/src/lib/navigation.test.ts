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

  it("preserva todas as rotas do gerente de escritório", () => {
    expect(getSidebarLinks("OFFICE").map(({ to }) => to)).toEqual([
      "/office/dashboard",
      "/office/consultants",
      "/office/clients",
      "/office/processes",
      "/office/company",
    ]);
  });

  it.each(["CUSTOMER", "CONSULTANT"] as const)(
    "preserva o rótulo autenticado de aeronaves para %s",
    (role) => {
      const aircraft = getSidebarLinks(role).find(
        ({ to }) => to === "/catalog/aircrafts",
      );

      expect(aircraft?.label).toBe("Aviões");
    },
  );

  it("não concede rotas privilegiadas a papel desconhecido", () => {
    expect(getSidebarLinks("UNKNOWN" as UserRole)).toEqual([]);
  });
});
