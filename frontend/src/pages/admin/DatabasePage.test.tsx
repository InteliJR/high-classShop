// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DatabasePage from "./DatabasePage";
import { deleteProcess, getEntities, getRecords } from "../../services/admin-database.service";

vi.mock("../../services/admin-database.service", () => ({
  deleteProcess: vi.fn(),
  getEntities: vi.fn(),
  getRecords: vi.fn(),
}));

vi.mock("../../components/admin/AdminUserManagementDialog", () => ({
  default: () => null,
}));

const records = {
  columns: [
    { label: "ID" },
    { label: "Cliente" },
    { label: "Especialista" },
    { label: "Produto" },
    { label: "Status" },
  ],
  data: [
    ["abc", "Ana Cliente", "Bia Especialista", "Carro A", "Agendamento"],
    ["def", "Carlos Cliente", "Dora Especialista", "Barco B", "Concluído"],
  ],
  rowMeta: [
    { id: "process-1", removed_at: null },
    { id: "process-2", removed_at: "2026-10-25T00:00:00.000Z" },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

beforeEach(() => {
  vi.mocked(getEntities).mockResolvedValue([{ key: "processes", label: "Processos" }]);
  vi.mocked(getRecords).mockResolvedValue(records);
  vi.mocked(deleteProcess).mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DatabasePage process removal", () => {
  it("shows deletion only for active processes and requires a reason", async () => {
    render(<DatabasePage />);

    const trash = await screen.findByRole("button", { name: "Excluir processo" });
    expect(screen.getAllByRole("button", { name: "Excluir processo" })).toHaveLength(1);
    fireEvent.click(trash);

    const dialog = screen.getByRole("dialog", { name: "Excluir processo" });
    expect(within(dialog).getByText("Ana Cliente")).toBeTruthy();
    expect(within(dialog).getByText("Bia Especialista")).toBeTruthy();
    expect(within(dialog).getByText("Carro A")).toBeTruthy();

    const confirm = within(dialog).getByRole("button", { name: "Excluir processo" });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo da exclusão/), {
      target: { value: "  processo duplicado  " },
    });
    expect(confirm.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(deleteProcess).toHaveBeenCalledWith("process-1", "processo duplicado");
    });
    expect(await screen.findByText(/Processo excluído da jornada/)).toBeTruthy();
  });
});
