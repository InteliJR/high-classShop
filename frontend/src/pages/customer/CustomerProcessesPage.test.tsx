// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerProcessesPage from "./CustomerProcessesPage";
import api from "../../services/api";

vi.mock("../../store/authStateManager", () => ({
  useAuth: () => ({ user: { id: "customer-1" } }),
}));
vi.mock("../../services/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/processes/ProcessCard", () => ({
  default: () => <p>Processo carregado</p>,
}));

const confirmation =
  "Recebemos sua solicitação e o especialista entrará em contato em instantes";
const base = {
  id: "process-1",
  appointment_id: "appointment-1",
  status: "SCHEDULING",
  product_type: null,
  appointment_status: "PENDING",
  appointment_scheduling_method: "EMAIL",
  consultancy_reason: "Meu motivo",
};

function renderPage(
  state: unknown = { consultancyAppointmentId: "appointment-1" },
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/customer/processes", state }]}>
      <CustomerProcessesPage />
    </MemoryRouter>,
  );
}

describe("CustomerProcessesPage consultancy confirmation", () => {
  beforeEach(() =>
    vi.mocked(api.get).mockResolvedValue({ data: { data: [base] } }),
  );
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("shows receipt after loading the persisted EMAIL request and distinguishes pending time", async () => {
    const { unmount } = renderPage();
    expect(await screen.findByText(confirmation)).toBeTruthy();
    expect(screen.getByText(/horário ainda será combinado/i)).toBeTruthy();
    unmount();
    renderPage();
    expect(await screen.findByText(confirmation)).toBeTruthy();
  });

  it.each(["SCHEDULED", "COMPLETED"])(
    "recognizes an actual confirmed Calendly appointment: %s",
    async (appointment_status) => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: [
            {
              ...base,
              appointment_status,
              appointment_scheduling_method: "CALENDLY",
            },
          ],
        },
      });
      renderPage();
      expect(await screen.findByText(confirmation)).toBeTruthy();
      expect(screen.getByText(/Horário confirmado/)).toBeTruthy();
    },
  );

  it.each([
    {
      appointment_status: "PENDING",
      appointment_scheduling_method: "CALENDLY",
    },
    { appointment_status: "CANCELLED" },
    { status: "REJECTED", appointment_status: "COMPLETED" },
    { appointment_id: "different-appointment" },
    { consultancy_reason: null, product_type: "CAR" },
  ])(
    "does not claim success for an unrelated or unconfirmed appointment: %p",
    async (changes) => {
      vi.mocked(api.get).mockResolvedValue({
        data: { data: [{ ...base, ...changes }] },
      });
      renderPage();
      await screen.findByText("Processo carregado");
      expect(screen.queryByText(confirmation)).toBeNull();
    },
  );

  it("does not show confirmation during an ordinary visit", async () => {
    renderPage(null);
    await screen.findByText("Processo carregado");
    expect(screen.queryByText(confirmation)).toBeNull();
  });

  it("does not show confirmation when loading the persisted request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(confirmation)).toBeNull();
    log.mockRestore();
  });
});
