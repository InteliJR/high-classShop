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
import {
  getPublicSpecialistById,
  type PublicSpecialistProfile,
} from "../../services/specialists.service";
import { checkExistingAppointment } from "../../services/appointments.service";

const { authState } = vi.hoisted(() => ({
  authState: {
    user: {
      id: "consultant-1",
      role: "CONSULTANT",
      name: "Consultor",
      surname: "Teste",
      email: "consultor@example.com",
    },
  },
}));

vi.mock("../../services/cars.service", () => ({ getCarById: vi.fn() }));
vi.mock("../../services/boats.service", () => ({ getBoatById: vi.fn() }));
vi.mock("../../services/aircrafts.service", () => ({ getAircraftById: vi.fn() }));
vi.mock("../../services/specialists.service", () => ({ getPublicSpecialistById: vi.fn() }));
vi.mock("../../services/consultant.service", () => ({
  getClients: vi.fn(),
  createConsultantProcess: vi.fn(),
}));
vi.mock("../../services/office", () => ({
  officeService: { listClients: vi.fn(), createProcess: vi.fn() },
}));
vi.mock("../../services/appointments.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/appointments.service")>()),
  checkExistingAppointment: vi.fn(),
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

const specialist: PublicSpecialistProfile = {
  id: "specialist-1",
  name: "Ana",
  surname: "Silva",
  speciality: "CAR",
  calendly_url: "https://calendly.com/ana/reuniao",
  calendly_scheduling_available: true,
};
const client = {
  id: "customer-1",
  name: "Cliente",
  surname: "Delegado",
  email: "cliente@example.com",
  cpf: "12345678900",
  rg: "12345678",
  role: "CUSTOMER" as const,
};

function pageContent() {
  return (
    <MemoryRouter initialEntries={["/catalog/car/car-1"]}>
      <Routes>
        <Route path="/catalog/:productType/:id" element={<ProductPage />} />
        <Route path="/consultant/processes" element={<h1>Processos do consultor</h1>} />
        <Route path="/office/processes" element={<h1>Processos do escritório</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function page(strict = false) {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return render(strict ? <StrictMode>{pageContent()}</StrictMode> : pageContent(), {
    container: root,
  });
}

async function submitDelegatedProcess() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Iniciar processo para cliente" }),
  );
  await user.click(await screen.findByRole("button", { name: /Cliente Delegado/ }));
  await user.click(screen.getByRole("button", { name: "Criar processo" }));
  return user;
}

describe("delegated EMAIL flow with the real Radix dialog", () => {
  beforeEach(() => {
    authState.user = { ...authState.user, role: "CONSULTANT" };
    vi.mocked(getCarById).mockResolvedValue({
      id: "car-1",
      marca: "Marca",
      modelo: "Modelo",
      valor: 100_000,
      currency: "BRL",
      estado: "novo",
      ano: 2026,
      specialist_id: specialist.id,
      identificador: "ABC-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(getPublicSpecialistById).mockResolvedValue(specialist);
    vi.mocked(checkExistingAppointment).mockResolvedValue({ exists: false, process: null });
    vi.mocked(getClients).mockResolvedValue([client]);
    vi.mocked(officeService.listClients).mockResolvedValue([
      {
        ...client,
        civil_state: null,
        consultant_id: null,
        consultant: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(createConsultantProcess).mockResolvedValue({
      id: "process-1",
      appointment_id: "appointment-1",
      status: "SCHEDULING",
    });
    vi.mocked(officeService.createProcess).mockResolvedValue({
      id: "process-1",
      appointment_id: "appointment-1",
    });
  });

  afterEach(() => {
    cleanup();
    document.getElementById("root")?.remove();
    vi.resetAllMocks();
  });

  it.each(["CONSULTANT", "OFFICE"] as const)(
    "creates %s delegated process as EMAIL without opening Calendly",
    async (role) => {
      authState.user.role = role;
      page();
      await submitDelegatedProcess();

      expect(
        await screen.findByRole("heading", {
          name: role === "OFFICE" ? "Processos do escritório" : "Processos do consultor",
        }),
      ).toBeTruthy();
      expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
      expect(
        role === "OFFICE" ? officeService.createProcess : createConsultantProcess,
      ).toHaveBeenCalledOnce();
    },
  );

  it.each(["Fechar", "Escape", "outside"])(
    "keeps the host nondismissible during POST for %s",
    async (action) => {
      let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
      vi.mocked(createConsultantProcess).mockImplementationOnce(
        () => new Promise((done) => {
          resolve = done;
        }),
      );
      page();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: "Iniciar processo para cliente" }),
      );
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

      await act(async () =>
        resolve({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" }),
      );
      expect(
        await screen.findByRole("heading", { name: "Processos do consultor" }),
      ).toBeTruthy();
      expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
    },
  );

  it("closes the idle host when clicked outside its panel", async () => {
    page();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Iniciar processo para cliente" }),
    );
    await screen.findByRole("button", { name: /Cliente Delegado/ });
    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not duplicate the delegated write in StrictMode", async () => {
    page(true);
    await submitDelegatedProcess();
    expect(
      await screen.findByRole("heading", { name: "Processos do consultor" }),
    ).toBeTruthy();
    expect(createConsultantProcess).toHaveBeenCalledOnce();
    expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
  });

  it("ignores unrelated global Calendly messages because delegated flow has no listener", async () => {
    page();
    fireEvent(window, new MessageEvent("message", {
      origin: "https://calendly.com",
      data: {
        event: "calendly.event_scheduled",
        payload: { event: { uri: "event-uri" }, invitee: { uri: "invitee-uri" } },
      },
    }));
    expect(createConsultantProcess).not.toHaveBeenCalled();
    expect(screen.queryByTitle("Calendly Scheduling Page")).toBeNull();
  });
});
