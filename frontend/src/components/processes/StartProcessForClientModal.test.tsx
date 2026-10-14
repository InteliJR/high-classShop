// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendlyEventListener } from "react-calendly";
import StartProcessForClientModal from "./StartProcessForClientModal";
import {
  createConsultantProcess,
  getClients,
  type Client,
} from "../../services/consultant.service";
import { officeService } from "../../services/office";

vi.mock("../../services/consultant.service", () => ({
  getClients: vi.fn(),
  createConsultantProcess: vi.fn(),
}));
vi.mock("../../services/office", () => ({
  officeService: { listClients: vi.fn(), createProcess: vi.fn() },
}));
vi.mock("react-calendly", () => ({ useCalendlyEventListener: vi.fn() }));

const client: Client = {
  id: "customer-1",
  name: "Cliente",
  surname: "Teste",
  email: "cliente@example.com",
  cpf: "12345678900",
  rg: "12345678",
  role: "CUSTOMER",
};
const secondClient: Client = {
  ...client,
  id: "customer-2",
  name: "Outro",
  email: "outro@example.com",
};

function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function scopeContent(
  props: {
    specialistId?: string;
    productType?: "CAR" | "BOAT" | "AIRCRAFT";
    productId?: string;
    mode?: "CONSULTANT" | "OFFICE";
    productLabel?: string;
    onBusyChange?(busy: boolean): void;
  } = {},
  visible = true,
) {
  return (
    <MemoryRouter initialEntries={["/start"]}>
      <Location />
      {visible && (
        <StartProcessForClientModal
          productType="CAR"
          productId="car-1"
          specialistId="specialist-1"
          onClose={vi.fn()}
          {...props}
        />
      )}
    </MemoryRouter>
  );
}

function renderModal(mode: "CONSULTANT" | "OFFICE" = "CONSULTANT") {
  return render(
    <MemoryRouter initialEntries={["/start"]}>
      <Routes>
        <Route
          path="/start"
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
        <Route path="/consultant/processes" element={<p>Processos do consultor</p>} />
        <Route path="/office/processes" element={<p>Processos do escritório</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function selectAndCreate() {
  fireEvent.click(
    await screen.findByRole("button", { name: /Cliente Teste/i }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Criar processo" }));
}

describe("StartProcessForClientModal delegated EMAIL flow", () => {
  beforeEach(() => {
    vi.mocked(getClients).mockResolvedValue([client]);
    vi.mocked(officeService.listClients).mockResolvedValue([
      {
        id: client.id,
        name: client.name,
        surname: client.surname,
        email: client.email,
        cpf: client.cpf,
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
    vi.resetAllMocks();
  });

  it.each(["CONSULTANT", "OFFICE"] as const)(
    "creates and navigates without mounting Calendly in %s mode",
    async (mode) => {
      renderModal(mode);
      await selectAndCreate();

      expect(
        await screen.findByText(
          mode === "OFFICE" ? "Processos do escritório" : "Processos do consultor",
        ),
      ).toBeTruthy();
      expect(
        mode === "OFFICE" ? officeService.createProcess : createConsultantProcess,
      ).toHaveBeenCalledWith({
        client_id: client.id,
        specialist_id: "specialist-1",
        product_type: "CAR",
        product_id: "car-1",
      });
      expect(useCalendlyEventListener).not.toHaveBeenCalled();
      expect(screen.queryByRole("link", { name: "Agendar no Calendly" })).toBeNull();
    },
  );

  it("keeps one submitted client and one write while creation is pending", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(getClients).mockResolvedValue([client, secondClient]);
    vi.mocked(createConsultantProcess).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    renderModal();
    await selectAndCreate();

    const other = screen.getByRole("button", { name: /Outro Teste/i }) as HTMLButtonElement;
    expect(other.disabled).toBe(true);
    fireEvent.click(other);
    fireEvent.click(screen.getByRole("button", { name: "Criando..." }));
    expect(createConsultantProcess).toHaveBeenCalledOnce();

    await act(async () =>
      resolve({ id: "process-1", appointment_id: "appointment-1", status: "SCHEDULING" }),
    );
    expect(createConsultantProcess).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: client.id }),
    );
  });

  it("reports creation errors inline and releases busy state", async () => {
    const onBusyChange = vi.fn();
    vi.mocked(createConsultantProcess).mockRejectedValue(new Error("Falha ao criar"));
    render(scopeContent({ onBusyChange }));
    await selectAndCreate();

    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao criar");
    expect(onBusyChange).toHaveBeenNthCalledWith(1, true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("location").textContent).toBe("/start");
  });

  it.each(["resolve", "reject"] as const)(
    "ignores obsolete creation %s after changing specialist scope",
    async (outcome) => {
      let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
      let reject!: (error: Error) => void;
      vi.mocked(createConsultantProcess).mockImplementationOnce(
        () => new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const view = render(scopeContent());
      await selectAndCreate();
      view.rerender(scopeContent({ specialistId: "specialist-2" }));

      await act(async () => {
        if (outcome === "resolve") {
          resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" });
        } else reject(new Error("old creation failed"));
      });

      expect(screen.queryByText("old creation failed")).toBeNull();
      expect(screen.getByTestId("location").textContent).toBe("/start");
      fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
      expect(
        (screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    },
  );

  it.each([
    { productType: "BOAT" as const },
    { productId: "car-2" },
    { mode: "OFFICE" as const },
  ])("invalidates in-flight creation for scope change %j", async (props) => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const view = render(scopeContent());
    await selectAndCreate();
    view.rerender(scopeContent(props));
    await act(async () =>
      resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" }),
    );

    expect(screen.getByTestId("location").textContent).toBe("/start");
  });

  it("does not navigate after unmount during creation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof createConsultantProcess>>) => void;
    vi.mocked(createConsultantProcess).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const view = render(scopeContent());
    await selectAndCreate();
    view.rerender(scopeContent({}, false));
    await act(async () =>
      resolve({ id: "old-process", appointment_id: "old-appointment", status: "SCHEDULING" }),
    );

    expect(screen.getByTestId("location").textContent).toBe("/start");
  });

  it("ignores an obsolete client list after switching mode", async () => {
    let resolve!: (value: Client[]) => void;
    vi.mocked(getClients).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    vi.mocked(officeService.listClients).mockResolvedValue([
      {
        id: secondClient.id,
        name: secondClient.name,
        surname: secondClient.surname,
        email: secondClient.email,
        cpf: secondClient.cpf,
        civil_state: null,
        consultant_id: null,
        consultant: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const view = render(scopeContent());
    view.rerender(scopeContent({ mode: "OFFICE" }));

    expect(await screen.findByRole("button", { name: /Outro Teste/i })).toBeTruthy();
    await act(async () => resolve([client]));
    expect(screen.queryByRole("button", { name: /Cliente Teste/i })).toBeNull();
  });

  it("keeps selection and search when only presentation props change", async () => {
    const view = render(scopeContent());
    fireEvent.click(await screen.findByRole("button", { name: /Cliente Teste/i }));
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou e-mail..."), {
      target: { value: "Cliente" },
    });
    view.rerender(scopeContent({ productLabel: "Novo texto" }));

    expect(
      (screen.getByRole("button", { name: "Criar processo" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByPlaceholderText("Buscar por nome ou e-mail...") as HTMLInputElement).value,
    ).toBe("Cliente");
    expect(getClients).toHaveBeenCalledOnce();
  });
});
