// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProcessCard from "./ProcessCard";
import type { Process } from "../../services/processes.service";
import {
  confirmAppointment,
  getMeetingByProcess,
  getProcessCompletionReason,
  getProcessWithActiveContract,
} from "../../services/processes.service";
import { rescheduleAppointment } from "../../services/appointments.service";
import { isoToLocalDateTimeInput } from "../../lib/appointment-datetime";

vi.mock("../../services/processes.service", () => ({
  confirmAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  getMeetingByProcess: vi.fn(),
  getProcessCompletionReason: vi.fn(),
  getProcessWithActiveContract: vi.fn(),
  markConversationDone: vi.fn(),
  startMeeting: vi.fn(),
  updateProcessStatus: vi.fn(),
}));

vi.mock("../../services/appointments.service", () => ({
  rescheduleAppointment: vi.fn(),
}));

const baseProcess: Process = {
  id: "process-1",
  status: "SCHEDULING",
  appointment_id: "appointment-1",
  appointment_status: "PENDING",
  appointment_datetime: null,
  appointment_scheduling_method: "EMAIL",
  specialist_rescheduled_at: null,
  specialist_rescheduled_from: null,
  product_type: "CAR",
  product_id: "car-1",
  client_id: "customer-1",
  specialist_id: "specialist-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  client: { id: "customer-1", name: "Cliente" },
  specialist: { id: "specialist-1", name: "Especialista" },
};

function renderCard(
  process: Process = baseProcess,
  props: { isClientView?: boolean; onStatusUpdated?: () => void } = {},
) {
  return render(
    <MemoryRouter>
      <ProcessCard process={process} {...props} />
    </MemoryRouter>,
  );
}

describe("ProcessCard appointment time actions", () => {
  beforeEach(() => {
    vi.mocked(getProcessCompletionReason).mockResolvedValue(null);
    vi.mocked(getProcessWithActiveContract).mockResolvedValue({
      activeContract: null,
    });
    vi.mocked(getMeetingByProcess).mockResolvedValue(null);
    vi.mocked(confirmAppointment).mockResolvedValue({
      processId: "process-1",
      status: "SCHEDULING",
      appointment_status: "SCHEDULED",
    });
    vi.mocked(rescheduleAppointment).mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets only the specialist define a missing email appointment time", () => {
    const { unmount } = renderCard();
    expect(
      screen.getByRole("button", { name: "Alterar e confirmar" }),
    ).toBeTruthy();

    unmount();
    renderCard(baseProcess, { isClientView: true });
    expect(
      screen.queryByRole("button", { name: "Alterar e confirmar" }),
    ).toBeNull();
  });

  it("does not offer manual confirmation for an undated Calendly request", () => {
    renderCard({
      ...baseProcess,
      appointment_scheduling_method: "CALENDLY",
    });

    expect(
      screen.queryByRole("button", { name: "Alterar e confirmar" }),
    ).toBeNull();
    expect(screen.getByText("Aguardando sincronização do Calendly")).toBeTruthy();
  });

  it("lets the specialist recover a legacy undated request", () => {
    renderCard({
      ...baseProcess,
      appointment_scheduling_method: null,
    });

    expect(
      screen.getByRole("button", { name: "Alterar e confirmar" }),
    ).toBeTruthy();
    expect(
      screen.queryByText("Aguardando sincronização do Calendly"),
    ).toBeNull();
  });

  it("confirms the time selected by the specialist", async () => {
    const onStatusUpdated = vi.fn();
    renderCard(baseProcess, { onStatusUpdated });

    fireEvent.click(
      screen.getByRole("button", { name: "Alterar e confirmar" }),
    );
    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar horário" }));

    await waitFor(() => {
      expect(confirmAppointment).toHaveBeenCalledWith(
        "process-1",
        new Date("2099-09-20T14:30").toISOString(),
      );
      expect(onStatusUpdated).toHaveBeenCalledOnce();
    });
  });

  it("offers the single definitive reschedule and submits it", async () => {
    const onStatusUpdated = vi.fn();
    renderCard(
      {
        ...baseProcess,
        appointment_status: "SCHEDULED",
        appointment_datetime: "2099-09-20T17:30:00.000Z",
      },
      { onStatusUpdated },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Alterar horário" }),
    );
    expect(
      screen.getByText(/Esta é a única alteração permitida/i),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-21T16:00" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar alteração" }),
    );

    await waitFor(() => {
      expect(rescheduleAppointment).toHaveBeenCalledWith(
        "appointment-1",
        new Date("2099-09-21T16:00").toISOString(),
      );
      expect(onStatusUpdated).toHaveBeenCalledOnce();
    });
  });

  it("replaces rescheduling with a definitive status after it was used", () => {
    renderCard({
      ...baseProcess,
      appointment_status: "SCHEDULED",
      appointment_datetime: "2099-09-20T17:30:00.000Z",
      specialist_rescheduled_at: "2026-09-16T20:00:00.000Z",
      specialist_rescheduled_from: "2099-09-19T17:30:00.000Z",
    });

    expect(
      screen.queryByRole("button", { name: "Alterar horário" }),
    ).toBeNull();
    expect(screen.getByText("Horário alterado definitivamente")).toBeTruthy();
  });

  it("keeps the modal open on backend errors and does not report success", async () => {
    const onStatusUpdated = vi.fn();
    vi.mocked(confirmAppointment).mockRejectedValue({
      response: {
        data: { error: { message: "Esse horário não está disponível." } },
      },
    });
    renderCard(baseProcess, { onStatusUpdated });

    fireEvent.click(
      screen.getByRole("button", { name: "Alterar e confirmar" }),
    );
    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar horário" }));

    expect(
      await screen.findByText("Esse horário não está disponível."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Data e hora")).toBeTruthy();
    expect(onStatusUpdated).not.toHaveBeenCalled();
  });

  it("refreshes the meeting action when the polled process changes", async () => {
    const scheduledProcess = {
      ...baseProcess,
      appointment_status: "SCHEDULED" as const,
      appointment_datetime: "2099-09-20T17:30:00.000Z",
    };
    vi.mocked(getMeetingByProcess)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "meeting-1",
        process_id: scheduledProcess.id,
        meet_link: "https://meet.example/1",
        started_at: "2026-09-16T20:00:00.000Z",
      });

    const view = renderCard(scheduledProcess, { isClientView: true });
    await waitFor(() => expect(getMeetingByProcess).toHaveBeenCalledTimes(1));

    view.rerender(
      <MemoryRouter>
        <ProcessCard
          process={{ ...scheduledProcess }}
          isClientView
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "Entrar Reunião" }),
    ).toBeTruthy();
    expect(getMeetingByProcess).toHaveBeenCalledTimes(2);
  });

  it("confirms the exact stored ISO without consuming rescheduling", async () => {
    const appointment_datetime = "2099-09-20T14:30:45.123-03:00";
    const onStatusUpdated = vi.fn();
    renderCard({ ...baseProcess, appointment_datetime }, { onStatusUpdated });
    expect(screen.getByRole("button", { name: "Alterar e confirmar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar horário" }));
    await waitFor(() => expect(confirmAppointment).toHaveBeenCalledWith(baseProcess.id, appointment_datetime));
    expect(onStatusUpdated).toHaveBeenCalledOnce();
    expect(rescheduleAppointment).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("prefills change-and-confirm and calls the canonical endpoint", async () => {
    const appointment_datetime = "2099-09-20T14:30:45.123-03:00";
    renderCard({ ...baseProcess, appointment_datetime });
    fireEvent.click(screen.getByRole("button", { name: "Alterar e confirmar" }));
    expect((screen.getByLabelText("Data e hora") as HTMLInputElement).value).toBe(isoToLocalDateTimeInput(appointment_datetime));
    expect(screen.queryByText(/única alteração permitida/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2099-09-21T16:00" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar horário" }));
    await waitFor(() => expect(confirmAppointment).toHaveBeenCalledWith(baseProcess.id, new Date("2099-09-21T16:00").toISOString()));
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("opens change-and-confirm after a direct 409 and keeps conflict inline", async () => {
    const appointment_datetime = "2099-09-20T17:30:00.000Z";
    vi.mocked(confirmAppointment).mockRejectedValue({ response: { status: 409, data: { error: { message: "Horário ocupado. Escolha outro horário." } } } });
    const onStatusUpdated = vi.fn();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderCard({ ...baseProcess, appointment_datetime }, { onStatusUpdated });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar horário" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toContain("Horário ocupado");
    expect((screen.getByLabelText("Data e hora") as HTMLInputElement).value).toBe(isoToLocalDateTimeInput(appointment_datetime));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar horário" }));
    await waitFor(() => expect(confirmAppointment).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onStatusUpdated).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("keeps a non-conflict direct error inline without opening the modal", async () => {
    vi.mocked(confirmAppointment).mockRejectedValue({ response: { status: 500, data: { error: { message: "Falha temporária." } } } });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar horário" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Falha temporária");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("disables both confirmation actions and reject while a direct request is pending", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof confirmAppointment>>) => void;
    vi.mocked(confirmAppointment).mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z" });
    const confirm = screen.getByRole("button", { name: "Confirmar horário" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Alterar e confirmar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Recusar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(confirmAppointment).toHaveBeenCalledOnce();
    await act(async () => resolve({ processId: baseProcess.id, status: "SCHEDULING", appointment_status: "SCHEDULED" }));
  });

  it("keeps meeting and later reschedule actions in SCHEDULED plus SCHEDULING", async () => {
    renderCard({ ...baseProcess, appointment_status: "SCHEDULED", appointment_datetime: "2099-09-20T17:30:00.000Z" });
    expect(await screen.findByRole("button", { name: "Iniciar Reunião" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alterar horário" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar horário" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Alterar e confirmar" })).toBeNull();
    expect(screen.queryByText("Solicitação de agendamento")).toBeNull();
  });

  it.each(["(11) 98765-4321", "+55 11 98765-4321"])("renders safe WhatsApp and preserves the original phone %s", (phone) => {
    renderCard({ ...baseProcess, client: { ...baseProcess.client!, email: "cliente@example.com", phone } });
    const link = screen.getByRole("link", { name: /WhatsApp/i });
    expect(link.getAttribute("href")).toBe("https://wa.me/5511987654321");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(phone)).toBeTruthy();
    expect(screen.getByRole("button", { name: `Copiar telefone do cliente: ${phone}` })).toBeTruthy();
  });

  it.each(["123", "ligar para ramal 42", null])("never generates WhatsApp for invalid/absent phone %s", (phone) => {
    renderCard({ ...baseProcess, client: { ...baseProcess.client!, phone } });
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
    if (phone) expect(screen.getByText(phone)).toBeTruthy();
    else expect(screen.queryByRole("button", { name: /Copiar telefone/i })).toBeNull();
  });

  it.each([
    { appointment_status: "CANCELLED" as const },
    { appointment_status: null },
    { appointment_status: undefined },
    { appointment_id: null },
  ])("does not offer confirmation outside an attached pending appointment: %j", (overrides) => {
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z", ...overrides });
    expect(screen.queryByRole("button", { name: "Confirmar horário" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Alterar e confirmar" })).toBeNull();
    expect(screen.queryByText("Solicitação de agendamento")).toBeNull();
  });

  it.each(["Cancelar", "Fechar", "Escape"])("returns focus to the change-and-confirm trigger after %s", async (action) => {
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z" });
    const trigger = screen.getByRole("button", { name: "Alterar e confirmar" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    if (action === "Escape") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("returns focus to direct confirmation after dismissing its 409 recovery", async () => {
    vi.mocked(confirmAppointment).mockRejectedValue({ response: { status: 409, data: { error: { message: "Escolha outro horário." } } } });
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z" });
    const trigger = screen.getByRole("button", { name: "Confirmar horário" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps modal and card controls busy during changed confirmation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof confirmAppointment>>) => void;
    vi.mocked(confirmAppointment).mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderCard({ ...baseProcess, appointment_datetime: "2099-09-20T17:30:00.000Z" });
    fireEvent.click(screen.getByRole("button", { name: "Alterar e confirmar" }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Confirmar horário" }) as HTMLButtonElement;
    fireEvent.click(submit);
    expect(submit.disabled).toBe(true);
    expect((screen.getByLabelText("Data e hora") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Fechar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => resolve({ processId: baseProcess.id, status: "SCHEDULING", appointment_status: "SCHEDULED" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });
});
