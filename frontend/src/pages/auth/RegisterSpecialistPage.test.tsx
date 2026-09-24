// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegisterSpecialistPage from "./RegisterSpecialistPage";
import { validateSpecialistInvite } from "../../services/specialists.service";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams("invite=signed-token")],
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: () => ({ setAccessToken: vi.fn(), setUser: vi.fn() }),
}));
vi.mock("../../services/specialists.service", () => ({
  validateSpecialistInvite: vi.fn(),
  registerSpecialist: vi.fn(),
}));
vi.mock("../../services/appointments.service", () => ({
  getCalendlyAuthorizeUrl: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.mocked(validateSpecialistInvite).mockReset());

describe("RegisterSpecialistPage", () => {
  it("mostra a comissão assinada como somente leitura", async () => {
    vi.mocked(validateSpecialistInvite).mockResolvedValue({
      email: "especialista@example.com",
      speciality: "CAR",
      commission_rate: 25,
    });

    render(<RegisterSpecialistPage />);

    expect(
      await screen.findByLabelText("Comissão definida pelo administrador"),
    ).toHaveProperty(
      "readOnly",
      true,
    );
  });

  it("explica o zero efetivo de um convite legado", async () => {
    vi.mocked(validateSpecialistInvite).mockResolvedValue({
      email: "legado@example.com",
      speciality: "BOAT",
      commission_rate: null,
    });

    render(<RegisterSpecialistPage />);

    expect(
      await screen.findByText(
        "Comissão ainda não configurada; o valor efetivo atual é 0%.",
      ),
    ).toBeTruthy();
  });
});
