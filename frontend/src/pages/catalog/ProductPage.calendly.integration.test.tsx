// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage from "./ProductPage";
import { getCarById } from "../../services/cars.service";
import { createConsultantProcess, getClients } from "../../services/consultant.service";
import { officeService } from "../../services/office";
import { getPublicSpecialistById, type PublicSpecialistProfile } from "../../services/specialists.service";
import { checkExistingAppointment, getCalendlySyncStatus, registerCalendlyScheduledEvent } from "../../services/appointments.service";

const { authState } = vi.hoisted(() => ({
  authState: { user: { id: "consultant-1", role: "CONSULTANT", name: "Consultor", surname: "Teste", email: "consultor@example.com" } },
}));

vi.mock("../../services/cars.service", () => ({ getCarById: vi.fn() }));
vi.mock("../../services/boats.service", () => ({ getBoatById: vi.fn() }));
vi.mock("../../services/aircrafts.service", () => ({ getAircraftById: vi.fn() }));
vi.mock("../../services/specialists.service", () => ({ getPublicSpecialistById: vi.fn() }));
vi.mock("../../services/consultant.service", () => ({ getClients: vi.fn(), createConsultantProcess: vi.fn() }));
vi.mock("../../services/office", () => ({ officeService: { listClients: vi.fn(), createProcess: vi.fn() } }));
vi.mock("../../services/appointments.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/appointments.service")>()),
  checkExistingAppointment: vi.fn(),
  getCalendlySyncStatus: vi.fn(),
  registerCalendlyScheduledEvent: vi.fn(),
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector?: (state: typeof authState) => unknown) => selector ? selector(authState) : authState,
}));

const specialist: PublicSpecialistProfile = {
  id: "specialist-1", name: "Ana", surname: "Silva", email: "ana@example.com", speciality: "CAR",
  calendly_url: "https://calendly.com/ana/reuniao", calendly_scheduling_available: true,
};
const client = { id: "customer-1", name: "Cliente", surname: "Delegado", email: "cliente@example.com", cpf: "12345678900", rg: "12345678", role: "CUSTOMER" as const };

function pageContent() {
  return <MemoryRouter initialEntries={["/catalog/car/car-1"]}>
    <Routes>
      <Route path="/catalog/:productType/:id" element={<ProductPage />} />
      <Route path="/consultant/processes" element={<h1>Processos do consultor</h1>} />
      <Route path="/office/processes" element={<h1>Processos do escritório</h1>} />
    </Routes>
  </MemoryRouter>;
}

function page(strict = false) {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return render(strict ? <StrictMode>{pageContent()}</StrictMode> : pageContent(), { container: root });
}

async function openCalendly(preserveEnabledFocus = false) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Iniciar processo para cliente" }));
  await user.click(await screen.findByRole("button", { name: /Cliente Delegado/ }));
  if (preserveEnabledFocus) {
    act(() => screen.getByPlaceholderText<HTMLInputElement>("Buscar por nome ou e-mail...").focus());
    fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
  } else {
    await user.click(screen.getByRole("button", { name: "Criar processo" }));
  }
  const iframe = await screen.findByTitle<HTMLIFrameElement>("Calendly Scheduling Page");
  return { user, iframe };
}

describe("delegated Calendly with the real Radix dialog and PopupModal", () => {
  beforeEach(() => {
    authState.user = { ...authState.user, role: "CONSULTANT" };
    vi.mocked(getCarById).mockResolvedValue({
      id: "car-1", marca: "Marca", modelo: "Modelo", valor: 100_000, currency: "BRL", estado: "novo", ano: 2026,
      specialist_id: specialist.id, identificador: "ABC-1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(getPublicSpecialistById).mockResolvedValue(specialist);
    vi.mocked(checkExistingAppointment).mockResolvedValue({ exists: false });
    vi.mocked(getClients).mockResolvedValue([client]);
    vi.mocked(officeService.listClients).mockResolvedValue([{ ...client, civil_state: null, consultant_id: null, consultant: null, created_at: "2026-01-01T00:00:00.000Z" }]);
    vi.mocked(createConsultantProcess).mockResolvedValue({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" });
    vi.mocked(officeService.createProcess).mockResolvedValue({ id: "process-1", appointment_id: "appointment-1" });
    vi.mocked(registerCalendlyScheduledEvent).mockResolvedValue({} as never);
    vi.mocked(getCalendlySyncStatus).mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
    document.getElementById("root")?.remove();
    vi.resetAllMocks();
  });

  it.each(["CONSULTANT", "OFFICE"])("keeps the real %s popup accessible inside the host focus scope", async (role) => {
    authState.user.role = role;
    page();
    const { iframe } = await openCalendly();
    expect(iframe.closest('[aria-hidden="true"]') === null).toBe(true);
    expect(screen.getByRole("dialog").contains(iframe)).toBe(true);
    expect(screen.getByRole("button", { name: "Close modal" })).toBeTruthy();
    expect(new URL(iframe.src).searchParams.get("name")).toBe("Cliente Delegado");
    expect(new URL(iframe.src).searchParams.get("email")).toBe(client.email);
  });

  it.each(["CONSULTANT", "OFFICE"])("allows focus to enter the real %s Calendly iframe and close control", async (role) => {
    authState.user.role = role;
    page();
    const { iframe } = await openCalendly(true);
    act(() => iframe.focus());
    expect(document.activeElement).toBe(iframe);
    const close = iframe.closest(".calendly-overlay")!.querySelector<HTMLButtonElement>(".calendly-popup-close")!;
    act(() => close.focus());
    expect(document.activeElement).toBe(close);
  });

  it.each(["CONSULTANT", "OFFICE"])("isolates %s keyboard focus in the active popup without unmounting the form", async (role) => {
    authState.user.role = role;
    page();
    const { user, iframe } = await openCalendly();
    const slot = iframe.closest(".calendly-overlay")!.parentElement!;
    const search = screen.getByPlaceholderText<HTMLInputElement>("Buscar por nome ou e-mail...");
    const panel = search.closest<HTMLElement>("[inert]");
    expect(panel !== null).toBe(true);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.hidden).toBe(true);
    expect(slot.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(slot);
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.tab();
    expect(slot.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(slot.contains(document.activeElement)).toBe(true);
    let ancestor = slot.parentElement;
    while (ancestor && ancestor !== document.body) {
      expect(["", "none"]).toContain(ancestor.style.transform);
      expect(["", "none"]).toContain(ancestor.style.translate);
      expect(["", "visible"]).toContain(ancestor.style.overflow);
      ancestor = ancestor.parentElement;
    }
  });

  it.each(["CONSULTANT", "OFFICE"])("allows the real %s popup close button to redirect and release the host lock", async (role) => {
    authState.user.role = role;
    page();
    const { user, iframe } = await openCalendly();
    expect(getComputedStyle(iframe).pointerEvents).toBe("auto");
    const close = iframe.closest(".calendly-overlay")!.querySelector<HTMLButtonElement>(".calendly-popup-close")!;
    await user.click(close);
    expect(await screen.findByRole("heading", { name: role === "OFFICE" ? "Processos do escritório" : "Processos do consultor" })).toBeTruthy();
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
  });

  it.each(["Fechar", "Escape", "outside"])("keeps the real host nondismissible during POST for %s", async (action) => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    page();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Iniciar processo para cliente" }));
    await user.click(await screen.findByRole("button", { name: /Cliente Delegado/ }));
    await user.click(screen.getByRole("button", { name: "Criar processo" }));
    if (action === "Fechar") {
      const close = screen.getByRole<HTMLButtonElement>("button", { name: "Fechar" });
      expect(close.disabled).toBe(true);
      await user.click(close);
    } else if (action === "Escape") {
      await user.keyboard("{Escape}");
    } else {
      await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    }
    expect(screen.getByRole("dialog").getAttribute("data-state")).toBe("open");
    expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
    await act(async () => resolve({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" }));
    const iframe = await screen.findByTitle<HTMLIFrameElement>("Calendly Scheduling Page");
    await user.click(iframe.closest(".calendly-overlay")!.querySelector<HTMLButtonElement>(".calendly-popup-close")!);
    expect(await screen.findByRole("heading", { name: "Processos do consultor" })).toBeTruthy();
  });

  it("closes the idle host when clicked outside its panel", async () => {
    page();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Iniciar processo para cliente" }));
    await screen.findByRole("button", { name: /Cliente Delegado/ });
    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it.each(["CONSULTANT", "OFFICE"])("synchronizes a real Calendly event before redirecting in %s mode", async (role) => {
    authState.user.role = role;
    page();
    await openCalendly();
    fireEvent(window, new MessageEvent("message", {
      origin: "https://calendly.com",
      data: { event: "calendly.event_scheduled", payload: { event: { uri: "event-uri" }, invitee: { uri: "invitee-uri" } } },
    }));
    expect(await screen.findByRole("heading", { name: role === "OFFICE" ? "Processos do escritório" : "Processos do consultor" })).toBeTruthy();
    expect(registerCalendlyScheduledEvent).toHaveBeenCalledWith("appointment-1", expect.objectContaining({ event_uri: "event-uri", invitee_uri: "invitee-uri" }));
    expect(getCalendlySyncStatus).toHaveBeenCalledWith("appointment-1");
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  });

  it("ignores synchronization completion after the real popup is closed", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof registerCalendlyScheduledEvent>>) => void;
    vi.mocked(registerCalendlyScheduledEvent).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    page();
    const { user, iframe } = await openCalendly();
    fireEvent(window, new MessageEvent("message", {
      origin: "https://calendly.com",
      data: { event: "calendly.event_scheduled", payload: { event: { uri: "event-uri" }, invitee: { uri: "invitee-uri" } } },
    }));
    await waitFor(() => expect(registerCalendlyScheduledEvent).toHaveBeenCalledOnce());
    await user.click(iframe.closest(".calendly-overlay")!.querySelector<HTMLButtonElement>(".calendly-popup-close")!);
    expect(await screen.findByRole("heading", { name: "Processos do consultor" })).toBeTruthy();
    await act(async () => resolve({} as never));
    expect(getCalendlySyncStatus).not.toHaveBeenCalled();
    expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
  });

  it("keeps popup focus across rerenders in StrictMode without refocusing its slot", async () => {
    const view = page(true);
    const { user, iframe } = await openCalendly();
    const slot = iframe.closest(".calendly-overlay")!.parentElement!;
    expect(document.activeElement).toBe(slot);
    const refocus = vi.spyOn(slot, "focus");
    act(() => iframe.focus());
    view.rerender(<StrictMode>{pageContent()}</StrictMode>);
    expect(document.activeElement).toBe(iframe);
    expect(refocus).not.toHaveBeenCalled();
    const close = screen.getByRole<HTMLButtonElement>("button", { name: "Close modal" });
    act(() => close.focus());
    view.rerender(<StrictMode>{pageContent()}</StrictMode>);
    expect(document.activeElement).toBe(close);
    expect(refocus).not.toHaveBeenCalled();
    await user.click(close);
    expect(await screen.findByRole("heading", { name: "Processos do consultor" })).toBeTruthy();
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    expect(slot.isConnected).toBe(false);
    expect(refocus).not.toHaveBeenCalled();
    refocus.mockRestore();
  });
});
