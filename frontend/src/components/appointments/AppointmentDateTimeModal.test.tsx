// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserTimeZone } from "../../lib/appointment-datetime";
import AppointmentDateTimeModal from "./AppointmentDateTimeModal";

const defaultProps = {
  open: true,
  title: "Escolher data e hora",
  description: "Defina quando a reunião acontecerá.",
  submitLabel: "Confirmar agendamento",
  onOpenChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("AppointmentDateTimeModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submits the selected local datetime as ISO", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentDateTimeModal {...defaultProps} onSubmit={onSubmit} />);

    expect(screen.getByText(browserTimeZone())).toBeTruthy();
    const submit = screen.getByRole("button", {
      name: "Confirmar agendamento",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        new Date("2099-09-20T14:30").toISOString(),
      );
    });
  });

  it("keeps the modal open and shows validation errors", async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AppointmentDateTimeModal
        {...defaultProps}
        onSubmit={onSubmit}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2000-01-01T00:00" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    );

    expect(await screen.findByText("Selecione uma data e hora futuras")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("renders definitive and backend warnings while disabling busy actions", () => {
    render(
      <AppointmentDateTimeModal
        {...defaultProps}
        definitiveWarning="Esta alteração será definitiva."
        serverError="Esse horário não está mais disponível."
        busy
      />,
    );

    expect(screen.getByText("Esta alteração será definitiva.")).toBeTruthy();
    expect(
      screen.getByText("Esse horário não está mais disponível."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Confirmar agendamento",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
