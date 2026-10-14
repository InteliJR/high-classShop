// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartProcessForClientModal from "./StartProcessForClientModal";
import {
  getPublicSpecialistById,
  type PublicSpecialistProfile,
} from "../../services/specialists.service";
import { getUserById } from "../../services/users.service";
import {
  createConsultantProcess,
  getClients,
} from "../../services/consultant.service";
import { officeService } from "../../services/office";

vi.mock("../../services/specialists.service", () => ({
  getPublicSpecialistById: vi.fn(),
}));
vi.mock("../../services/users.service", () => ({ getUserById: vi.fn() }));
vi.mock("../../services/consultant.service", () => ({
  getClients: vi.fn(),
  createConsultantProcess: vi.fn(),
}));
vi.mock("../../services/office", () => ({
  officeService: { listClients: vi.fn(), createProcess: vi.fn() },
}));
vi.mock("../../services/appointments.service", () => ({
  registerCalendlyScheduledEvent: vi.fn(),
  getCalendlySyncStatus: vi.fn(),
}));
vi.mock("react-calendly", () => ({
  useCalendlyEventListener: vi.fn(),
  PopupModal: ({ url }: { url: string }) => <a href={url}>Calendly popup</a>,
}));

const client = {
  id: "client-1",
  name: "Cliente",
  surname: "Teste",
  email: "cliente@example.com",
};
const publicProfile: PublicSpecialistProfile = {
  id: "specialist-1",
  name: "Ana",
  surname: "Silva",
  email: "ana@example.com",
  speciality: "CAR",
  calendly_url: "https://calendly.com/ana",
  calendly_scheduling_available: true,
};

function renderModal(mode: "CONSULTANT" | "OFFICE") {
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <StartProcessForClientModal
              productType="CAR"
              productId="car-1"
              specialistId="specialist-1"
              mode={mode}
              onClose={vi.fn()}
            />
          }
        />
        <Route
          path="/consultant/processes"
          element={<div>Processos do consultor</div>}
        />
        <Route
          path="/office/processes"
          element={<div>Processos do escritório</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StartProcessForClientModal public specialist display", () => {
  beforeEach(() => {
    vi.mocked(getClients).mockResolvedValue([client] as never);
    vi.mocked(officeService.listClients).mockResolvedValue([client] as never);
    vi.mocked(getPublicSpecialistById).mockResolvedValue(publicProfile);
    vi.mocked(getUserById).mockResolvedValue(publicProfile as never);
    const process = {
      id: "process-1",
      status: "SCHEDULING",
      appointment_id: "appointment-1",
    };
    vi.mocked(createConsultantProcess).mockResolvedValue(process);
    vi.mocked(officeService.createProcess).mockResolvedValue(process);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(["CONSULTANT", "OFFICE"] as const)(
    "loads the public specialist profile in %s mode without private user access",
    async (mode) => {
      renderModal(mode);
      await screen.findByRole("button", { name: /Cliente Teste/ });
      await waitFor(() =>
        expect(getPublicSpecialistById).toHaveBeenCalledWith("specialist-1"),
      );
      expect(getUserById).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: /Cliente Teste/ }));
      fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
      const createProcess =
        mode === "OFFICE"
          ? officeService.createProcess
          : createConsultantProcess;
      await waitFor(() =>
        expect(createProcess).toHaveBeenCalledWith({
          client_id: "client-1",
          specialist_id: "specialist-1",
          product_type: "CAR",
          product_id: "car-1",
        }),
      );
      expect(
        (
          await screen.findByRole("link", { name: "Calendly popup" })
        ).getAttribute("href"),
      ).toBe(publicProfile.calendly_url);
    },
  );

  it("preserves process creation when the public profile has no Calendly URL", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...publicProfile,
      calendly_url: null,
      calendly_scheduling_available: false,
    });
    renderModal("CONSULTANT");
    fireEvent.click(
      await screen.findByRole("button", { name: /Cliente Teste/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
    expect(await screen.findByText("Processos do consultor")).toBeTruthy();
    expect(getUserById).not.toHaveBeenCalled();
  });
});
