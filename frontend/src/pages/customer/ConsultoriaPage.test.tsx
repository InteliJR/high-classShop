// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsultoriaPage from "./ConsultoriaPage";
import { AuthContext, type AuthContextProps } from "../../contexts/AuthContext";
import { getSpecialistsGroupedByCategory, type PublicSpecialistProfile } from "../../services/specialists.service";
import { createConsultancyAppointment } from "../../services/appointments.service";

const { openPopup, useCalendlySchedulingMock } = vi.hoisted(() => ({
  openPopup: vi.fn(),
  useCalendlySchedulingMock: vi.fn(),
}));
vi.mock("../../services/specialists.service", () => ({ getSpecialistsGroupedByCategory: vi.fn() }));
vi.mock("../../services/appointments.service", () => ({ createConsultancyAppointment: vi.fn() }));
vi.mock("../../hooks/useCalendlyScheduling", () => ({
  useCalendlyScheduling: useCalendlySchedulingMock,
}));

const specialist: PublicSpecialistProfile = { id: "specialist-1", name: "Ana", surname: "Silva", speciality: "CAR", calendly_url: "https://calendly.com/ana/reuniao", calendly_scheduling_available: false };
function mockSpecialist(value: PublicSpecialistProfile) {
  vi.mocked(getSpecialistsGroupedByCategory).mockResolvedValue({ CAR: [value], BOAT: [], AIRCRAFT: [] });
}
const reason = "Preciso de orientação para escolher um carro";
async function submitReason(value = reason) {
  fireEvent.change(await screen.findByRole("textbox", { name: "Comente brevemente sobre o motivo dessa conversa" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
}
function renderPage() {
  const context = { user: { id: "customer-1", name: "Cliente", surname: "Teste", email: "cliente@example.com", role: "CUSTOMER" } } as AuthContextProps;
  return render(<AuthContext.Provider value={context}><MemoryRouter initialEntries={["/consultoria?type=CAR"]}><Routes>
    <Route path="/consultoria" element={<ConsultoriaPage />} />
    <Route path="/customer/processes" element={<p>Meus processos</p>} />
  </Routes></MemoryRouter></AuthContext.Provider>);
}

describe("ConsultoriaPage capability", () => {
  beforeEach(() => {
    useCalendlySchedulingMock.mockReturnValue({
      isModalOpen: false,
      modalUrl: null,
      syncState: "idle",
      syncMessage: null,
      openPopup,
      closePopup: vi.fn(),
    });
    mockSpecialist(specialist);
    vi.mocked(createConsultancyAppointment).mockResolvedValue({ id: "appointment-1" } as never);
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); });

  it("creates EMAIL consultancy without product or date even with a stale URL", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar Reunião" }));
    await submitReason();
    expect(await screen.findByText("Meus processos")).toBeTruthy();
    expect(createConsultancyAppointment).toHaveBeenCalledWith({ client_id: "customer-1", specialist_id: specialist.id, scheduling_method: "EMAIL", notes: reason });
    expect(openPopup).not.toHaveBeenCalled();
  });

  it("preserves connected Calendly consultancy", async () => {
    mockSpecialist({ ...specialist, calendly_scheduling_available: true });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar Reunião" }));
    await submitReason();
    await waitFor(() => expect(openPopup).toHaveBeenCalledWith("appointment-1", specialist.calendly_url));
    expect(createConsultancyAppointment).toHaveBeenCalledWith(expect.objectContaining({ scheduling_method: "CALENDLY" }));
  });

  it("does not create EMAIL fallback for a capability true response missing its URL", async () => {
    mockSpecialist({ ...specialist, calendly_scheduling_available: true, calendly_url: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar Reunião" }));
    await submitReason();
    expect((await screen.findByRole("alert")).textContent).toContain("Calendly");
    expect(createConsultancyAppointment).not.toHaveBeenCalled();
    expect(openPopup).not.toHaveBeenCalled();
  });

  it("renders a terminal Calendly synchronization failure as a danger alert", async () => {
    useCalendlySchedulingMock.mockReturnValue({
      isModalOpen: false,
      modalUrl: null,
      syncState: "error",
      syncMessage: "O agendamento foi cancelado no Calendly.",
      openPopup,
      closePopup: vi.fn(),
    });

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("cancelado");
    expect(alert.className).toContain("bg-status-bad-wash");
    expect(alert.className).not.toContain("bg-status-ok-wash");
  });

  it("collects the reason before registering a request and does not repeat account fields", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar Reunião" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(createConsultancyAppointment).not.toHaveBeenCalled();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/e-mail|nome/i)).toBeNull();
  });

  it("keeps the reason and shows a retryable error without redirecting when registration fails", async () => {
    vi.mocked(createConsultancyAppointment).mockRejectedValue({ response: { data: { error: { message: "Falha ao registrar pedido" } } } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar Reunião" }));
    await submitReason();
    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao registrar pedido");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(reason);
    expect(screen.queryByText("Meus processos")).toBeNull();
    expect(openPopup).not.toHaveBeenCalled();
  });
});
