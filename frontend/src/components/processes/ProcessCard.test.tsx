// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      screen.getByRole("button", { name: "Definir data e hora" }),
    ).toBeTruthy();

    unmount();
    renderCard(baseProcess, { isClientView: true });
    expect(
      screen.queryByRole("button", { name: "Definir data e hora" }),
    ).toBeNull();
  });

  it("confirms the time selected by the specialist", async () => {
    const onStatusUpdated = vi.fn();
    renderCard(baseProcess, { onStatusUpdated });

    fireEvent.click(
      screen.getByRole("button", { name: "Definir data e hora" }),
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
      screen.getByRole("button", { name: "Definir data e hora" }),
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
});
