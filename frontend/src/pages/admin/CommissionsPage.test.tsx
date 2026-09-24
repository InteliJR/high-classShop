// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommissionsPage from "./CommissionsPage";
import { getSpecialists, updateSpecialist } from "../../services/specialists.service";

vi.mock("../../services/companies.service", () => ({
  getCompanies: vi.fn().mockResolvedValue([]),
  updateCompany: vi.fn(),
}));
vi.mock("../../services/specialists.service", () => ({
  getSpecialists: vi.fn(),
  updateSpecialist: vi.fn(),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSearchParams: () => [new URLSearchParams()],
}));

afterEach(cleanup);

describe("CommissionsPage", () => {
  it("permite salvar zero e remove a flag de comissão nula", async () => {
    const legacy = {
      id: "specialist-1",
      name: "Ana",
      surname: "Silva",
      email: "ana@example.com",
      cpf: "",
      rg: "",
      password_hash: "",
      speciality: "CAR" as const,
      commission_rate: null,
    };
    vi.mocked(getSpecialists).mockResolvedValue([legacy]);
    vi.mocked(updateSpecialist).mockResolvedValue({
      ...legacy,
      commission_rate: 0,
    });

    render(<CommissionsPage />);
    expect(await screen.findByText("Comissão não configurada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateSpecialist).toHaveBeenCalledWith("specialist-1", {
        commission_rate: 0,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Comissão não configurada")).toBeNull(),
    );
  });

  it("mostra a mensagem de precisão sem salvar uma comissão inválida", async () => {
    vi.mocked(updateSpecialist).mockClear();
    vi.mocked(getSpecialists).mockResolvedValue([
      {
        id: "specialist-2",
        name: "Bruno",
        surname: "Costa",
        email: "bruno@example.com",
        cpf: "",
        rg: "",
        password_hash: "",
        speciality: "CAR",
        commission_rate: 12,
      },
    ]);

    render(<CommissionsPage />);
    const input = await screen.findByLabelText("Bruno Costa");
    fireEvent.change(input, { target: { value: "12.345" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("A comissão deve ter no máximo duas casas decimais."),
    ).toBeTruthy();
    expect(updateSpecialist).not.toHaveBeenCalled();
  });

  it("aceita vírgula decimal ao editar a taxa", async () => {
    vi.mocked(updateSpecialist).mockClear();
    vi.mocked(getSpecialists).mockResolvedValue([
      {
        id: "specialist-3",
        name: "Carla",
        surname: "Lima",
        email: "carla@example.com",
        cpf: "",
        rg: "",
        password_hash: "",
        speciality: "CAR",
        commission_rate: 12,
      },
    ]);
    vi.mocked(updateSpecialist).mockResolvedValue({
      id: "specialist-3",
      name: "Carla",
      surname: "Lima",
      email: "carla@example.com",
      cpf: "",
      rg: "",
      password_hash: "",
      speciality: "CAR",
      commission_rate: 1.5,
    });

    render(<CommissionsPage />);
    fireEvent.change(await screen.findByLabelText("Carla Lima"), {
      target: { value: "1,5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateSpecialist).toHaveBeenCalledWith("specialist-3", {
        commission_rate: 1.5,
      }),
    );
  });
});
