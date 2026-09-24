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
});
