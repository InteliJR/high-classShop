// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartProcessForClientModal from "./StartProcessForClientModal";
import { createConsultantProcess, getClients, type Client } from "../../services/consultant.service";
import { getPublicSpecialistById, type PublicSpecialistProfile } from "../../services/specialists.service";
import { getUserById } from "../../services/users.service";
import { officeService } from "../../services/office";
import { getCalendlySyncStatus, registerCalendlyScheduledEvent } from "../../services/appointments.service";
import { useCalendlyEventListener } from "react-calendly";

const { popupClosers } = vi.hoisted(() => ({ popupClosers: [] as Array<() => void> }));

vi.mock("../../services/consultant.service", () => ({ getClients: vi.fn(), createConsultantProcess: vi.fn() }));
vi.mock("../../services/office", () => ({ officeService: { listClients: vi.fn(), createProcess: vi.fn() } }));
vi.mock("../../services/specialists.service", () => ({ getPublicSpecialistById: vi.fn() }));
vi.mock("../../services/users.service", () => ({ getUserById: vi.fn() }));
vi.mock("../../services/appointments.service", () => ({ getCalendlySyncStatus: vi.fn(), registerCalendlyScheduledEvent: vi.fn() }));
vi.mock("react-calendly", () => ({
  PopupModal: ({ url, prefill, onModalClose }: { url: string; prefill: { name?: string; email?: string }; onModalClose(): void }) => {
    popupClosers.push(onModalClose);
    return <><a href={url} data-client-name={prefill.name} data-client-email={prefill.email}>Agendar no Calendly</a><button onClick={onModalClose}>Fechar Calendly</button></>;
  },
  useCalendlyEventListener: vi.fn(),
}));

const client: Client = { id: "customer-1", name: "Cliente", surname: "Teste", email: "cliente@example.com", cpf: "12345678900", rg: "12345678", role: "CUSTOMER" };
const specialist: PublicSpecialistProfile = { id: "specialist-1", name: "Ana", surname: "Silva", email: "ana@example.com", speciality: "CAR", calendly_url: "https://calendly.com/ana/reuniao", calendly_scheduling_available: false };
const secondClient: Client = { ...client, id: "customer-2", name: "Outro", email: "outro@example.com" };
function Location() { return <p data-testid="location">{useLocation().pathname}</p>; }
function scopeContent(props: { specialistId?: string; productType?: "CAR" | "BOAT" | "AIRCRAFT"; productId?: string; mode?: "CONSULTANT" | "OFFICE"; onCalendlyOpenChange?(open: boolean): void } = {}, visible = true) {
  return <MemoryRouter initialEntries={["/start"]}><Location />{visible && <StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialist.id} onClose={vi.fn()} {...props} />}</MemoryRouter>;
}

function renderModal(mode: "CONSULTANT" | "OFFICE" = "CONSULTANT") {
  return render(<MemoryRouter initialEntries={["/start"]}><Routes>
    <Route path="/start" element={<StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialist.id} mode={mode} onClose={vi.fn()} />} />
    <Route path="/consultant/processes" element={<p>Processos do consultor</p>} />
    <Route path="/office/processes" element={<p>Processos do escritório</p>} />
  </Routes></MemoryRouter>);
}

async function selectAndCreate() {
  fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
  fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
}

describe("StartProcessForClientModal capability", () => {
  beforeEach(() => {
    popupClosers.length = 0;
    vi.mocked(getClients).mockResolvedValue([client]);
    vi.mocked(officeService.listClients).mockResolvedValue([{ id: client.id, name: client.name, surname: client.surname, email: client.email, cpf: client.cpf, civil_state: null, consultant_id: null, consultant: null, created_at: "2026-01-01T00:00:00.000Z" }]);
    vi.mocked(getPublicSpecialistById).mockResolvedValue(specialist);
    vi.mocked(createConsultantProcess).mockResolvedValue({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" });
    vi.mocked(officeService.createProcess).mockResolvedValue({ id: "process-1", appointment_id: "appointment-1" });
    vi.mocked(registerCalendlyScheduledEvent).mockResolvedValue({} as never);
    vi.mocked(getCalendlySyncStatus).mockResolvedValue({} as never);
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });

  it.each(["CONSULTANT", "OFFICE"] as const)("ignores a stale URL when capability is false in %s mode", async (mode) => {
    renderModal(mode);
    await selectAndCreate();
    expect(await screen.findByText(mode === "OFFICE" ? "Processos do escritório" : "Processos do consultor")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
    expect(getPublicSpecialistById).toHaveBeenCalledWith(specialist.id);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it.each(["CONSULTANT", "OFFICE"] as const)("opens Calendly only for capability true in %s mode", async (mode) => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({ ...specialist, calendly_scheduling_available: true });
    renderModal(mode);
    await selectAndCreate();
    expect((await screen.findByRole("link", { name: "Agendar no Calendly" })).getAttribute("href")).toBe(specialist.calendly_url);
    expect(mode === "OFFICE" ? officeService.createProcess : createConsultantProcess).toHaveBeenCalledWith({ client_id: client.id, specialist_id: specialist.id, product_type: "CAR", product_id: "car-1" });
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("preserves process creation without a Calendly URL when capability is false", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({ ...specialist, calendly_url: null });
    renderModal();
    await selectAndCreate();
    expect(await screen.findByText("Processos do consultor")).toBeTruthy();
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("waits for the public capability before allowing creation", async () => {
    let resolve!: (value: PublicSpecialistProfile) => void;
    vi.mocked(getPublicSpecialistById).mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderModal();
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    const create = screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(create);
    expect(createConsultantProcess).not.toHaveBeenCalled();
    await act(async () => resolve(specialist));
    await waitFor(() => expect(create.disabled).toBe(false));
  });

  it("shows a load error and prevents treating unavailable capability as false", async () => {
    vi.mocked(getPublicSpecialistById).mockRejectedValue(new Error("offline"));
    renderModal();
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("especialista");
    expect((screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(createConsultantProcess).not.toHaveBeenCalled();
  });

  it("does not fall back when capability is true but its URL is absent", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({ ...specialist, calendly_scheduling_available: true, calendly_url: null });
    renderModal();
    await selectAndCreate();
    expect((await screen.findByRole("alert")).textContent).toContain("Calendly");
    expect(createConsultantProcess).not.toHaveBeenCalled();
    expect(screen.queryByText("Processos do consultor")).toBeNull();
  });

  it("resets capability and ignores an old specialist response after switching specialistId", async () => {
    let resolveOld!: (value: PublicSpecialistProfile) => void;
    vi.mocked(getPublicSpecialistById).mockImplementationOnce(() => new Promise((done) => { resolveOld = done; })).mockResolvedValueOnce({ ...specialist, id: "specialist-2", calendly_url: null });
    const view = render(<MemoryRouter><StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialist.id} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    view.rerender(<MemoryRouter><StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId="specialist-2" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled).toBe(false));
    await act(async () => resolveOld({ ...specialist, calendly_scheduling_available: true }));
    fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
    await waitFor(() => expect(createConsultantProcess).toHaveBeenCalledWith(expect.objectContaining({ specialist_id: "specialist-2" })));
    expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
  });

  it.each(["resolve", "reject"] as const)("ignores obsolete creation %s after changing specialist scope", async (outcome) => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    let reject!: (error: Error) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done, fail) => { resolve = done; reject = fail; }));
    vi.mocked(getPublicSpecialistById).mockResolvedValueOnce({ ...specialist, calendly_scheduling_available: true }).mockResolvedValueOnce({ ...specialist, id: "specialist-2", calendly_url: null });
    const content = (specialistId: string) => <MemoryRouter initialEntries={["/start"]}>
      <Location />
      <StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialistId} onClose={vi.fn()} />
    </MemoryRouter>;
    const view = render(content(specialist.id));
    await selectAndCreate();
    expect(createConsultantProcess).toHaveBeenCalledOnce();
    view.rerender(content("specialist-2"));
    await waitFor(() => expect(getPublicSpecialistById).toHaveBeenCalledWith("specialist-2"));
    await act(async () => {
      if (outcome === "resolve") resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" });
      else reject(new Error("old creation failed"));
    });
    expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
    expect(screen.queryByText("old creation failed")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("/start");
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    expect((screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([{ productType: "BOAT" as const }, { productId: "car-2" }, { mode: "OFFICE" as const }])("invalidates in-flight creation for scope change %j", async (props) => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(scopeContent());
    await selectAndCreate();
    view.rerender(scopeContent(props));
    await act(async () => resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" }));
    expect(screen.getByTestId("location").textContent).toBe("/start");
    expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
  });

  it.each(["resolve", "reject"] as const)("does not let the old %s/finally release the new A→B→A request", async (outcome) => {
    let resolveOld!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    let rejectOld!: (error: Error) => void;
    let resolveCurrent!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(getPublicSpecialistById).mockImplementation(async (id) => ({ ...specialist, id, calendly_scheduling_available: true }));
    vi.mocked(createConsultantProcess)
      .mockImplementationOnce(() => new Promise((done, fail) => { resolveOld = done; rejectOld = fail; }))
      .mockImplementationOnce(() => new Promise((done) => { resolveCurrent = done; }));
    const view = render(scopeContent());
    await selectAndCreate();
    view.rerender(scopeContent({ specialistId: "specialist-2" }));
    await waitFor(() => expect(getPublicSpecialistById).toHaveBeenCalledWith("specialist-2"));
    view.rerender(scopeContent());
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
    await waitFor(() => expect(createConsultantProcess).toHaveBeenCalledTimes(2));
    await act(async () => {
      if (outcome === "resolve") resolveOld({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" });
      else rejectOld(new Error("old creation failed"));
    });
    expect((screen.getByRole("button", { name: "Criando..." }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
    await act(async () => resolveCurrent({ id: "current-process", appointment_id: "current-appointment", status: "SCHEDULING" }));
    expect(await screen.findByRole("link", { name: "Agendar no Calendly" })).toBeTruthy();
  });

  it("does not navigate after the modal unmounts during creation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(scopeContent());
    await selectAndCreate();
    view.rerender(scopeContent({}, false));
    await act(async () => resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" }));
    expect(screen.getByTestId("location").textContent).toBe("/start");
  });

  it("ignores the old client list after switching mode and clears the selection", async () => {
    let resolve!: (value: Client[]) => void;
    vi.mocked(getClients).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    vi.mocked(officeService.listClients).mockResolvedValue([{ id: secondClient.id, name: secondClient.name, surname: secondClient.surname, email: secondClient.email, cpf: secondClient.cpf, civil_state: null, consultant_id: null, consultant: null, created_at: "2026-01-01T00:00:00.000Z" }]);
    const view = render(scopeContent());
    view.rerender(scopeContent({ mode: "OFFICE" }));
    expect(await screen.findByRole("button", { name: /Outro Teste/i })).toBeTruthy();
    await act(async () => resolve([client]));
    expect(screen.getByRole("button", { name: /Outro Teste/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cliente Teste/i })).toBeNull();
    expect((screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the popup prefill tied to the submitted client while creation is busy", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(getClients).mockResolvedValue([client, secondClient]);
    vi.mocked(getPublicSpecialistById).mockResolvedValue({ ...specialist, calendly_scheduling_available: true });
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    renderModal();
    await selectAndCreate();
    const other = screen.getByRole("button", { name: /Outro Teste/i }) as HTMLButtonElement;
    expect(other.disabled).toBe(true);
    fireEvent.click(other);
    await act(async () => resolve({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" }));
    const popup = await screen.findByRole("link", { name: "Agendar no Calendly" });
    expect(popup.getAttribute("data-client-name")).toBe("Cliente Teste");
    expect(popup.getAttribute("data-client-email")).toBe(client.email);
    expect(createConsultantProcess).toHaveBeenCalledWith(expect.objectContaining({ client_id: client.id }));
  });

  it("ignores Calendly sync completion after its scope changes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof registerCalendlyScheduledEvent>>) => void;
    vi.mocked(getPublicSpecialistById).mockImplementation(async (id) => ({ ...specialist, id, calendly_scheduling_available: true }));
    vi.mocked(registerCalendlyScheduledEvent).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(scopeContent());
    await selectAndCreate();
    await screen.findByRole("link", { name: "Agendar no Calendly" });
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0].onEventScheduled!;
    let sync!: Promise<unknown>;
    act(() => { sync = Promise.resolve(listener({ data: { event: "calendly.event_scheduled", payload: { event: { uri: "event-uri" }, invitee: { uri: "invitee-uri" } } } } as Parameters<typeof listener>[0])); });
    view.rerender(scopeContent({ specialistId: "specialist-2" }));
    await act(async () => { resolve({} as never); await sync; });
    expect(getCalendlySyncStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId("location").textContent).toBe("/start");
  });

  it("retries the same Calendly registration after PENDING before redirecting", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_scheduling_available: true,
    });
    vi.mocked(registerCalendlyScheduledEvent)
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        calendly_sync_status: "PENDING",
        appointment_datetime: null,
      })
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        calendly_sync_status: "SYNCED",
        appointment_datetime: "2099-01-01T10:00:00.000Z",
      });
    vi.mocked(getCalendlySyncStatus)
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        status: "PENDING",
        calendly_sync_status: "PENDING",
        appointment_datetime: null,
        calendly_last_sync_at: null,
      })
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        status: "SCHEDULED",
        calendly_sync_status: "SYNCED",
        appointment_datetime: "2099-01-01T10:00:00.000Z",
        calendly_last_sync_at: "2099-01-01T09:59:00.000Z",
      });
    renderModal();
    await selectAndCreate();
    await screen.findByRole("link", { name: "Agendar no Calendly" });
    vi.useFakeTimers();
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    act(() => {
      void Promise.resolve(
        listener({
          data: {
            event: "calendly.event_scheduled",
            payload: {
              event: { uri: "event-uri" },
              invitee: { uri: "invitee-uri" },
            },
          },
        } as Parameters<typeof listener>[0]),
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(registerCalendlyScheduledEvent).mock.calls[0][1]).toEqual(
      vi.mocked(registerCalendlyScheduledEvent).mock.calls[1][1],
    );
    expect(screen.getByText("Processos do consultor")).toBeTruthy();
    vi.useRealTimers();
  });

  it("keeps the selected client when only label or callback props change", async () => {
    const view = render(scopeContent());
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou e-mail..."), { target: { value: "Cliente" } });
    view.rerender(<MemoryRouter initialEntries={["/start"]}><Location /><StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialist.id} productLabel="Novo texto" onClose={() => {}} /></MemoryRouter>);
    expect((screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByPlaceholderText("Buscar por nome ou e-mail...") as HTMLInputElement).value).toBe("Cliente");
    expect(getClients).toHaveBeenCalledOnce();
    expect(getPublicSpecialistById).toHaveBeenCalledOnce();
  });

  it("ignores callbacks belonging to an obsolete Calendly popup before any HTTP write", async () => {
    vi.mocked(getPublicSpecialistById).mockImplementation(async (id) => ({ ...specialist, id, calendly_scheduling_available: true }));
    const onCalendlyOpenChange = vi.fn();
    const view = render(scopeContent({ onCalendlyOpenChange }));
    await selectAndCreate();
    await screen.findByRole("link", { name: "Agendar no Calendly" });
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0].onEventScheduled!;
    const close = popupClosers.at(-1)!;
    expect(onCalendlyOpenChange).toHaveBeenLastCalledWith(true);
    view.rerender(scopeContent({ specialistId: "specialist-2", onCalendlyOpenChange }));
    expect(onCalendlyOpenChange).toHaveBeenLastCalledWith(false);
    onCalendlyOpenChange.mockClear();
    await act(async () => {
      close();
      await listener({ data: { event: "calendly.event_scheduled", payload: { event: { uri: "event-uri" }, invitee: { uri: "invitee-uri" } } } } as Parameters<typeof listener>[0]);
    });
    expect(registerCalendlyScheduledEvent).not.toHaveBeenCalled();
    expect(getCalendlySyncStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId("location").textContent).toBe("/start");
    expect(onCalendlyOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the current popup close flow and releases its busy state", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({ ...specialist, calendly_scheduling_available: true });
    const onBusyChange = vi.fn();
    const onCalendlyOpenChange = vi.fn();
    render(<MemoryRouter initialEntries={["/start"]}><Location /><StartProcessForClientModal calendlyRootElement={document.body} productType="CAR" productId="car-1" specialistId={specialist.id} onClose={vi.fn()} onBusyChange={onBusyChange} onCalendlyOpenChange={onCalendlyOpenChange} /></MemoryRouter>);
    await selectAndCreate();
    expect(await screen.findByRole("link", { name: "Agendar no Calendly" })).toBeTruthy();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(onCalendlyOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Fechar Calendly" }));
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(onCalendlyOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("location").textContent).toBe("/consultant/processes");
  });
});
