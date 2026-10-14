// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import ProductPage from "./ProductPage";
import { createConsultantProcess, getClients } from "../../services/consultant.service";
import { getCarById } from "../../services/cars.service";
import { getUserById } from "../../services/users.service";
import {
  getPublicSpecialistById,
  type PublicSpecialistProfile,
} from "../../services/specialists.service";
import {
  checkExistingAppointment,
  createPendingAppointment,
  createPlatformAppointment,
  type ActiveProcessSnapshot,
  type PendingAppointmentCreated,
} from "../../services/appointments.service";

const { authState, openPopup } = vi.hoisted(() => ({
  authState: {
    user: {
      id: "customer-1",
      role: "CUSTOMER",
      name: "Cliente",
      surname: "Teste",
      email: "cliente@example.com",
    },
  },
  openPopup: vi.fn(),
}));

vi.mock("../../services/cars.service", () => ({ getCarById: vi.fn() }));
vi.mock("../../services/boats.service", () => ({ getBoatById: vi.fn() }));
vi.mock("../../services/aircrafts.service", () => ({
  getAircraftById: vi.fn(),
}));
vi.mock("../../services/users.service", () => ({ getUserById: vi.fn() }));
vi.mock("../../services/specialists.service", () => ({
  getPublicSpecialistById: vi.fn(),
}));
vi.mock("../../services/processes.service", () => ({
  getProcessesByClient: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/appointments.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../services/appointments.service")
  >()),
  checkExistingAppointment: vi.fn(),
  createPendingAppointment: vi.fn(),
  createPlatformAppointment: vi.fn(),
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));
vi.mock("../../hooks/useCalendlyScheduling", () => ({
  useCalendlyScheduling: () => ({
    isModalOpen: false,
    modalUrl: null,
    syncState: "idle",
    syncMessage: null,
    openPopup,
    closePopup: vi.fn(),
  }),
}));
vi.mock("react-calendly", () => ({ PopupModal: () => null, useCalendlyEventListener: vi.fn() }));
vi.mock("../../components/product/ProductDetails", () => ({
  default: () => <div>Detalhes do produto</div>,
}));
vi.mock("../../services/consultant.service", () => ({ getClients: vi.fn(), createConsultantProcess: vi.fn() }));

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
const specialist: PublicSpecialistProfile = {
  id: "specialist-1",
  name: "Especialista",
  surname: "Teste",
  email: "especialista@example.com",
  calendly_url: null,
  speciality: "CAR",
  calendly_scheduling_available: false,
};
const appointment: PendingAppointmentCreated = {
  id: "appointment-product-created",
  process_id: "process-1",
  client_id: "customer-1",
  specialist_id: "specialist-1",
  product_type: "CAR",
  product_id: "car-1",
  appointment_datetime: "2099-09-20T17:30:00.000Z",
  status: "PENDING",
  scheduling_method: "EMAIL",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
const existingRequest: ActiveProcessSnapshot = {
  appointment_id: "appointment-recovered",
  process_id: "process-1",
  appointment_status: "PENDING",
  scheduling_method: "EMAIL",
  appointment_datetime: appointment.appointment_datetime ?? null,
};

function ChangeProductButton() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/catalog/car/car-2")}>
      Ver outro produto
    </button>
  );
}

function page() {
  return (
    <MemoryRouter initialEntries={["/catalog/car/car-1"]}>
      <ChangeProductButton />
      <Routes>
        <Route path="/catalog/:productType/:id" element={<ProductPage />} />
        <Route path="/customer/processes" element={<div>Meus processos</div>} />
        <Route path="/consultant/processes" element={<div>Processos delegados</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function chooseDateTime() {
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: "Solicitar reunião" },
      { timeout: 2000 },
    ),
  );
  fireEvent.change(screen.getByLabelText("Data e hora"), {
    target: { value: "2099-09-20T14:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
}

function duplicate(snapshot: ActiveProcessSnapshot) {
  return {
    response: {
      status: 409,
      data: {
        error: {
          code: "ACTIVE_PROCESS_EXISTS",
          details: { existing_request: snapshot },
        },
      },
    },
  };
}

describe("ProductPage scheduling", () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.user = {
      id: "customer-1",
      role: "CUSTOMER",
      name: "Cliente",
      surname: "Teste",
      email: "cliente@example.com",
    };
    vi.mocked(getCarById).mockResolvedValue(product);
    vi.mocked(getPublicSpecialistById).mockResolvedValue(specialist);
    vi.mocked(checkExistingAppointment).mockResolvedValue({ exists: false });
    vi.mocked(createPendingAppointment).mockResolvedValue(appointment);
    vi.mocked(getClients).mockResolvedValue([{ id: "delegated-client", name: "Cliente", surname: "Delegado", email: "cliente@example.com", cpf: "12345678900", rg: "12345678", role: "CUSTOMER" }]);
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it.each(["Fechar", "Escape", "outside"])("keeps the delegated process dialog open during POST when attempting %s", async (action) => {
    authState.user = { ...authState.user, role: "CONSULTANT" };
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar processo para cliente" }));
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Delegado/i }));
    fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
    const dialog = screen.getByRole("dialog");
    if (action === "Fechar") {
      const close = screen.getByRole("button", { name: "Fechar" }) as HTMLButtonElement;
      expect(close.disabled).toBe(true);
      fireEvent.click(close);
    } else if (action === "Escape") {
      fireEvent.keyDown(dialog, { key: "Escape" });
    } else {
      await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    }
    expect(screen.getByRole("dialog").getAttribute("data-state")).toBe("open");
    await act(async () => resolve({ id: "delegated-process", appointment_id: "delegated-appointment", status: "SCHEDULING" }));
    expect(createConsultantProcess).toHaveBeenCalledOnce();
    expect(await screen.findByText("Processos delegados")).toBeTruthy();
  });

  it("allows an idle delegated dialog to close outside", async () => {
    authState.user = { ...authState.user, role: "CONSULTANT" };
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar processo para cliente" }));
    await screen.findByRole("button", { name: /Cliente Delegado/i });
    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads the public specialist projection and checks the own request without a client ID", async () => {
    render(page());
    expect(
      await screen.findByRole(
        "button",
        { name: "Solicitar reunião" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(getPublicSpecialistById).toHaveBeenCalledWith("specialist-1");
    expect(getUserById).not.toHaveBeenCalled();
    expect(checkExistingAppointment).toHaveBeenCalledWith(
      "specialist-1",
      "CAR",
      "car-1",
    );
  });

  it("uses the false capability even when a stale Calendly URL remains", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_url: "https://calendly.com/stale",
    });
    render(page());
    expect(
      await screen.findByRole(
        "button",
        { name: "Solicitar reunião" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Agendar reunião com o especialista",
      }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar e-mail" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Escolher data e hora" }),
    ).toBeNull();
  });

  it("keeps the active Calendly path and opens its popup only after creation", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_url: "https://calendly.com/especialista",
      calendly_scheduling_available: true,
    });
    vi.mocked(createPendingAppointment).mockResolvedValue({
      ...appointment,
      scheduling_method: "CALENDLY",
      appointment_datetime: null,
    });
    render(page());
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Agendar reunião com o especialista" },
        { timeout: 2000 },
      ),
    );
    await waitFor(() =>
      expect(openPopup).toHaveBeenCalledWith(
        appointment.id,
        "https://calendly.com/especialista",
      ),
    );
    const payload = vi.mocked(createPendingAppointment).mock.calls[0][0];
    expect(payload.scheduling_method).toBe("CALENDLY");
    expect(payload).not.toHaveProperty("appointment_datetime");
    expect(
      screen.queryByRole("button", { name: "Solicitar reunião" }),
    ).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("uses only the true capability when its URL is unexpectedly missing", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_scheduling_available: true,
    });
    render(page());
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Agendar reunião com o especialista" },
        { timeout: 2000 },
      ),
    );
    expect(
      await screen.findByText(
        /Não foi possível abrir a agenda do especialista/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Solicitar reunião" }),
    ).toBeNull();
    expect(createPendingAppointment).not.toHaveBeenCalled();
  });

  it("keeps a generic Calendly 409 as an error without opening its popup or mail", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_url: "https://calendly.com/especialista",
      calendly_scheduling_available: true,
    });
    vi.mocked(createPendingAppointment).mockRejectedValue({
      response: { status: 409 },
      friendlyMessage: "Agenda indisponível",
    });
    render(page());
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Agendar reunião com o especialista" },
        { timeout: 2000 },
      ),
    );
    expect(await screen.findByText("Agenda indisponível")).toBeTruthy();
    expect(openPopup).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    expect(checkExistingAppointment).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 950));
    expect(screen.queryByText("Meus processos")).toBeNull();
  });

  it("prevents a second Calendly submission while its creation is unresolved", async () => {
    vi.mocked(getPublicSpecialistById).mockResolvedValue({
      ...specialist,
      calendly_url: "https://calendly.com/especialista",
      calendly_scheduling_available: true,
    });
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(page());
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Agendar reunião com o especialista" },
        { timeout: 2000 },
      ),
    );
    await waitFor(() =>
      expect(createPendingAppointment).toHaveBeenCalledOnce(),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Criando solicitação...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Criando solicitação..." }),
    );
    expect(createPendingAppointment).toHaveBeenCalledOnce();
    expect(openPopup).not.toHaveBeenCalled();
    await act(async () =>
      resolve({
        ...appointment,
        scheduling_method: "CALENDLY",
        appointment_datetime: null,
      }),
    );
    expect(openPopup).toHaveBeenCalledOnce();
  });

  it("collects a proposal without creating or opening an email before submit", async () => {
    render(page());
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Solicitar reunião" },
        { timeout: 2000 },
      ),
    );
    expect(screen.getByRole("dialog").textContent).toMatch(
      /confirmação do especialista/i,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar solicitação",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(createPendingAppointment).not.toHaveBeenCalled();
    expect(createPlatformAppointment).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("creates PENDING EMAIL with the chosen ISO and commits a persistent panel before opening", async () => {
    vi.mocked(createPendingAppointment).mockResolvedValue({
      ...appointment,
      id: "appointment-product-initial-success",
    });
    let panelCommittedAtOpen = false;
    let modalUnmountedAtOpen = false;
    vi.mocked(window.open).mockImplementation(() => {
      panelCommittedAtOpen = Boolean(screen.queryByRole("status"));
      modalUnmountedAtOpen = screen.queryByRole("dialog") === null;
      return null;
    });
    render(page());
    await chooseDateTime();
    await waitFor(() => expect(window.open).toHaveBeenCalledOnce());
    expect(panelCommittedAtOpen).toBe(true);
    expect(modalUnmountedAtOpen).toBe(true);
    expect(createPendingAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "customer-1",
        specialist_id: "specialist-1",
        product_id: "car-1",
        product_type: "CAR",
        scheduling_method: "EMAIL",
        appointment_datetime: new Date("2099-09-20T14:30").toISOString(),
      }),
    );
    expect(createPlatformAppointment).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Abrir no Gmail" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Acompanhar processo" })
        .getAttribute("href"),
    ).toBe("/customer/processes");
    expect(screen.queryByText("Meus processos")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    );
  });

  it("waits for the 201 response and prevents double submission while busy", async () => {
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(page());
    await chooseDateTime();
    const submit = screen.getByRole("button", {
      name: "Enviar solicitação",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);
    expect(createPendingAppointment).toHaveBeenCalledOnce();
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () =>
      resolve({ ...appointment, id: "appointment-delayed" }),
    );
    await waitFor(() => expect(window.open).toHaveBeenCalledOnce());
  });

  it.each([
    { response: { status: 409 }, friendlyMessage: "Conflito genérico" },
    {
      response: {
        status: 409,
        data: {
          error: {
            code: "EMAIL_FLOW_UNAVAILABLE",
            message: "Conflito genérico",
          },
        },
      },
    },
    {
      response: {
        status: 409,
        data: {
          error: {
            code: "ACTIVE_PROCESS_EXISTS",
            message: "Conflito genérico",
          },
        },
      },
    },
    {
      response: {
        status: 409,
        data: {
          code: "ACTIVE_PROCESS_EXISTS",
          existing_request: existingRequest,
        },
      },
      friendlyMessage: "Conflito genérico",
    },
    {
      response: {
        status: 409,
        data: {
          error: {
            code: "ACTIVE_PROCESS_EXISTS",
            message: "Conflito genérico",
            details: { existing_request: { process_id: "process-1" } },
          },
        },
      },
    },
  ])(
    "keeps a generic or malformed 409 as an inline error (%#)",
    async (error) => {
      vi.mocked(createPendingAppointment).mockRejectedValue(error);
      render(page());
      await chooseDateTime();
      expect(await screen.findByText("Conflito genérico")).toBeTruthy();
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
      expect(window.open).not.toHaveBeenCalled();
      expect(checkExistingAppointment).toHaveBeenCalledOnce();
    },
  );

  it("does not open email after a creation failure", async () => {
    vi.mocked(createPendingAppointment).mockRejectedValue(
      new Error("Falha de rede"),
    );
    render(page());
    await chooseDateTime();
    expect(await screen.findByText("Falha de rede")).toBeTruthy();
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("recovers the strict owned duplicate snapshot without refetching or automatic opening", async () => {
    vi.mocked(createPendingAppointment).mockRejectedValue(
      duplicate(existingRequest),
    );
    render(page());
    await chooseDateTime();
    expect(
      await screen.findByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir no Gmail" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Acompanhar processo" })
        .getAttribute("href"),
    ).toBe("/customer/processes");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
    expect(checkExistingAppointment).toHaveBeenCalledOnce();
    expect(
      sessionStorage.getItem("email-request-opened:appointment-recovered"),
    ).toBeNull();
  });

  it("recovers the same email panel after a reload without automatic opening", async () => {
    const view = render(page());
    await chooseDateTime();
    await waitFor(() => expect(window.open).toHaveBeenCalledOnce());
    view.unmount();
    vi.mocked(checkExistingAppointment).mockResolvedValue({
      ...existingRequest,
      exists: true,
      appointment_id: appointment.id,
      appointment_status: "PENDING",
    });
    render(page());
    expect(
      await screen.findByRole(
        "link",
        { name: "Abrir aplicativo de e-mail" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Acompanhar processo" })
        .getAttribute("href"),
    ).toBe("/customer/processes");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(window.open).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Solicitar reunião" }),
    ).toBeNull();
  });

  it("recovers an own pending request on the initial visit even without a session marker", async () => {
    vi.mocked(checkExistingAppointment).mockResolvedValue({
      ...existingRequest,
      exists: true,
      appointment_id: "appointment-own-initial",
      appointment_status: "PENDING",
    });
    render(page());
    expect(
      await screen.findByRole(
        "link",
        { name: "Abrir no Gmail" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(window.open).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(
      screen.getByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    );
  });

  it.each([
    {
      ...existingRequest,
      appointment_id: null,
      appointment_status: null,
      scheduling_method: null,
      appointment_datetime: null,
    },
    { ...existingRequest, scheduling_method: "CALENDLY" as const },
    { ...existingRequest, appointment_status: "SCHEDULED" as const },
    { ...existingRequest, appointment_datetime: null },
    { ...existingRequest, appointment_datetime: "invalid" },
  ])(
    "guides other owned active process snapshots without offering email composition (%#)",
    async (snapshot) => {
      vi.mocked(createPendingAppointment).mockRejectedValue(
        duplicate(snapshot),
      );
      render(page());
      await chooseDateTime();
      expect(
        await screen.findByRole("link", { name: "Acompanhar processo" }),
      ).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Abrir no Gmail" })).toBeNull();
      expect(window.open).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it.each([
    {
      appointment_status: "PENDING" as const,
      scheduling_method: "CALENDLY" as const,
      message: "Aguardando confirmação do especialista",
    },
    {
      appointment_status: "SCHEDULED" as const,
      scheduling_method: "EMAIL" as const,
      message: "Agendamento já realizado",
    },
  ])(
    "preserves $appointment_status/$scheduling_method existing appointment messaging",
    async ({ appointment_status, scheduling_method, message }) => {
      vi.mocked(checkExistingAppointment).mockResolvedValue({
        ...existingRequest,
        exists: true,
        appointment_id: "existing-other",
        appointment_status,
        scheduling_method,
      });
      render(page());
      expect(
        await screen.findByText(message, {}, { timeout: 2000 }),
      ).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Abrir no Gmail" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Solicitar reunião" }),
      ).toBeNull();
    },
  );

  it("blocks creation when the own-request check fails", async () => {
    vi.mocked(checkExistingAppointment).mockRejectedValue(
      new Error("check unavailable"),
    );
    render(page());
    expect(
      await screen.findByText(
        /Não foi possível validar seus agendamentos agora/,
        {},
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Solicitar reunião" }),
    ).toBeNull();
  });

  it("ignores a late created request after the authenticated customer changes", async () => {
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(page());
    await chooseDateTime();
    authState.user = { ...authState.user, id: "customer-2", name: "Outro" };
    view.rerender(page());
    await act(async () =>
      resolve({ ...appointment, id: "appointment-old-customer" }),
    );
    expect(
      await screen.findByRole(
        "button",
        { name: "Solicitar reunião" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir no Gmail" })).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores a late created request after the authenticated role changes", async () => {
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(page());
    await chooseDateTime();
    authState.user = { ...authState.user, role: "SPECIALIST" };
    view.rerender(page());
    await act(async () =>
      resolve({ ...appointment, id: "appointment-old-role" }),
    );
    expect(
      screen.getByText(/Apenas clientes podem agendar reuniões/),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir no Gmail" })).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("ignores a late created request after the selected product changes", async () => {
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(page());
    await chooseDateTime();
    vi.mocked(getCarById).mockResolvedValue({
      ...product,
      id: "car-2",
      modelo: "Outro Modelo",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ver outro produto", hidden: true }),
    );
    await act(async () =>
      resolve({ ...appointment, id: "appointment-old-product" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Marca Outro Modelo" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole(
        "button",
        { name: "Solicitar reunião" },
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir no Gmail" })).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open an email after unmount during creation", async () => {
    let resolve!: (value: PendingAppointmentCreated) => void;
    vi.mocked(createPendingAppointment).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(page());
    await chooseDateTime();
    view.unmount();
    await act(async () =>
      resolve({ ...appointment, id: "appointment-unmounted" }),
    );
    expect(window.open).not.toHaveBeenCalled();
  });
});
