// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminUserManagementDialog from "./AdminUserManagementDialog";
import * as management from "../../lib/admin-user-management";
import { getCompanies } from "../../services/companies.service";

vi.mock("../../services/companies.service", () => ({ getCompanies: vi.fn() }));
vi.spyOn(management, "validateRoleChange").mockResolvedValue({
  allowed: true,
  summary: "Alteração permitida.",
  blockers: [],
});

afterEach(cleanup);

describe("AdminUserManagementDialog", () => {
  it("envia especialidade e comissão zero ao promover para especialista", async () => {
    render(
      <AdminUserManagementDialog
        state={{ userId: "user-1", mode: "role" }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo cargo"), {
      target: { value: "SPECIALIST" },
    });
    fireEvent.change(screen.getByLabelText("Especialidade"), {
      target: { value: "BOAT" },
    });
    fireEvent.change(screen.getByLabelText("Taxa de comissão (%)"), {
      target: { value: "0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar alteração" }),
    );

    await waitFor(() =>
      expect(management.validateRoleChange).toHaveBeenCalledWith("user-1", {
        role: "SPECIALIST",
        speciality: "BOAT",
        commission_rate: 0,
      }),
    );
  });

  it("envia comissão ao substituir um gerente por especialista", async () => {
    vi.mocked(getCompanies).mockResolvedValueOnce([
      { id: "office-1", name: "Matriz", cnpj: "00.000.000/0001-00" },
    ]);
    vi.mocked(management.validateRoleChange)
      .mockResolvedValueOnce({
        allowed: false,
        summary: "É preciso substituir o gerente.",
        blockers: [
          {
            code: "OFFICE_CONFLICT",
            message: "O escritório já possui um gerente ativo.",
          },
        ],
      })
      .mockResolvedValueOnce({
        allowed: true,
        summary: "Alteração permitida.",
        blockers: [],
      });

    render(
      <AdminUserManagementDialog
        state={{ userId: "user-1", mode: "role" }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo cargo"), {
      target: { value: "OFFICE" },
    });
    fireEvent.change(await screen.findByLabelText("Escritório"), {
      target: { value: "office-1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar alteração" }),
    );

    await screen.findByLabelText("Cargo de substituição");
    fireEvent.change(screen.getByLabelText("Cargo de substituição"), {
      target: { value: "SPECIALIST" },
    });
    fireEvent.change(
      screen.getByLabelText("Especialidade do gerente atual"),
      { target: { value: "CAR" } },
    );
    fireEvent.change(
      screen.getByLabelText("Taxa de comissão do gerente atual (%)"),
      { target: { value: "0" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar alteração" }),
    );

    await waitFor(() =>
      expect(management.validateRoleChange).toHaveBeenLastCalledWith(
        "user-1",
        {
          role: "OFFICE",
          company_id: "office-1",
          replacement: {
            role: "SPECIALIST",
            speciality: "CAR",
            commission_rate: 0,
          },
        },
      ),
    );
  });
});
