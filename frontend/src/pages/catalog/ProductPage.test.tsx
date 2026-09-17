// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage from "./ProductPage";
import { getCarById } from "../../services/cars.service";
import { getUserById } from "../../services/users.service";
import {
  checkExistingAppointment,
  createPendingAppointment,
  createPlatformAppointment,
} from "../../services/appointments.service";

vi.mock("../../services/cars.service", () => ({ getCarById: vi.fn() }));
vi.mock("../../services/boats.service", () => ({ getBoatById: vi.fn() }));
vi.mock("../../services/aircrafts.service", () => ({ getAircraftById: vi.fn() }));
vi.mock("../../services/users.service", () => ({ getUserById: vi.fn() }));
vi.mock("../../services/processes.service", () => ({
  getProcessesByClient: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/appointments.service", () => ({
  checkExistingAppointment: vi.fn(),
  createPendingAppointment: vi.fn(),
  createPlatformAppointment: vi.fn(),
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: () => ({
    user: {
      id: "customer-1",
      role: "CUSTOMER",
      name: "Cliente",
      surname: "Teste",
      email: "cliente@example.com",
    },
  }),
}));
vi.mock("../../hooks/useCheckAppointment", () => ({
  useCheckAppointment: () => ({
    existingAppointment: null,
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../../hooks/useCalendlyScheduling", () => ({
  useCalendlyScheduling: () => ({
    isModalOpen: false,
    modalUrl: null,
    syncState: "idle",
    syncMessage: null,
    openPopup: vi.fn(),
    closePopup: vi.fn(),
  }),
}));
vi.mock("react-calendly", () => ({ PopupModal: () => null }));
vi.mock("../../components/product/ProductDetails", () => ({
  default: () => <div>Detalhes do produto</div>,
}));
vi.mock("../../components/processes/StartProcessForClientModal", () => ({
  default: () => null,
}));

const product = {
  id: "car-1",
  marca: "Marca",
  modelo: "Modelo",
  identificador: "ABC-1",
  valor: 100_000,
  currency: "BRL" as const,
  estado: "novo",
  ano: 2026,
  specialist_id: "specialist-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const specialist = {
  id: "specialist-1",
  name: "Especialista",
  surname: "Teste",
  email: "especialista@example.com",
  calendly_url: null,
  speciality: "CAR",
};

const appointment = {
  id: "appointment-1",
  client_id: "customer-1",
  specialist_id: "specialist-1",
  product_type: "CAR" as const,
  product_id: "car-1",
  appointment_datetime: "2099-09-20T17:30:00.000Z",
  status: "SCHEDULED" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/catalog/car/car-1"]}>
      <Routes>
        <Route path="/catalog/:productType/:id" element={<ProductPage />} />
        <Route
          path="/customer/processes"
          element={<div>Meus processos</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductPage scheduling", () => {
  beforeEach(() => {
    vi.mocked(getCarById).mockResolvedValue(product);
    vi.mocked(getUserById).mockResolvedValue(specialist as never);
    vi.mocked(checkExistingAppointment).mockResolvedValue(null);
    vi.mocked(createPendingAppointment).mockResolvedValue({
      ...appointment,
      status: "PENDING",
      appointment_datetime: null,
    });
    vi.mocked(createPlatformAppointment).mockResolvedValue(appointment);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps Calendly as the only path when it is configured", async () => {
    vi.mocked(getUserById).mockResolvedValue({
      ...specialist,
      calendly_url: "https://calendly.com/especialista",
    } as never);

    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "Agendar reunião com o especialista",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar e-mail" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Escolher data e hora" }),
    ).toBeNull();
  });

  it("creates the email request with its explicit scheduling method", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(createPendingAppointment).mockResolvedValue({
      ...appointment,
      status: "PENDING",
      appointment_datetime: null,
      scheduling_method: "EMAIL",
    });
    renderPage();

    expect(
      await screen.findByRole("link", { name: "especialista@example.com" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar e-mail" }),
    );

    await waitFor(() => {
      expect(createPendingAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ scheduling_method: "EMAIL" }),
      );
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^mailto:especialista@example\.com/),
        "_self",
      );
    });
    expect(
      screen.getByRole("link", { name: "especialista@example.com" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Acompanhar em Meus Processos" }),
    ).toBeTruthy();
    expect(
      vi.mocked(createPendingAppointment).mock.invocationCallOrder[0],
    ).toBeLessThan(openSpy.mock.invocationCallOrder[0]);
  });

  it("creates an internal appointment with the selected datetime", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Escolher data e hora" }),
    );
    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    );

    await waitFor(() => {
      expect(createPlatformAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          appointment_datetime: new Date("2099-09-20T14:30").toISOString(),
        }),
      );
      expect(screen.getByText("Meus processos")).toBeTruthy();
    });
  });

  it("redirects to the existing process on a duplicate conflict", async () => {
    vi.mocked(createPlatformAppointment).mockRejectedValue({
      response: { status: 409 },
      friendlyMessage: "Já existe processo ativo para este produto.",
    });
    vi.mocked(checkExistingAppointment).mockResolvedValue(appointment);
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Escolher data e hora" }),
    );
    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    );

    expect(await screen.findByText("Meus processos")).toBeTruthy();
  });
});
