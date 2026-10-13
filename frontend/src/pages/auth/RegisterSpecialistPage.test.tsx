// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegisterSpecialistPage from "./RegisterSpecialistPage";
import {
  registerSpecialist,
  validateSpecialistInvite,
} from "../../services/specialists.service";

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

  it("apresenta o Calendly como opcional após criar a conta", async () => {
    vi.mocked(validateSpecialistInvite).mockResolvedValue({
      email: "especialista@example.com",
      speciality: "CAR",
      commission_rate: 25,
    });
    vi.mocked(registerSpecialist).mockResolvedValue({
      access_token: "access-token",
      user: {
        id: "specialist-1",
        name: "Maria",
        surname: "Silva",
        email: "especialista@example.com",
        cpf: "12345678000199",
        rg: "123456789",
        role: "SPECIALIST",
        speciality: "CAR",
      },
    });

    const { container } = render(<RegisterSpecialistPage />);

    await screen.findByText("Especialidade:");
    const textInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="text"]:not([readonly])',
    );
    fireEvent.change(textInputs[0], { target: { value: "Maria" } });
    fireEvent.change(textInputs[1], { target: { value: "Silva" } });
    fireEvent.change(textInputs[2], { target: { value: "12345678000199" } });
    fireEvent.change(textInputs[3], { target: { value: "123456789" } });
    fireEvent.change(textInputs[4], { target: { value: "11999999999" } });
    fireEvent.change(container.querySelector('input[type="password"]')!, {
      target: { value: "senha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText(/Calendly é opcional/i)).toBeTruthy();
    expect(screen.queryByText(/para poder anunciar produtos/i)).toBeNull();
  });
});
