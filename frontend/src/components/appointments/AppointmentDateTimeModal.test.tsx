// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import { browserTimeZone, isoToLocalDateTimeInput } from "../../lib/appointment-datetime";
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
    vi.restoreAllMocks();
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

  it("clears a backend error when the user changes the datetime", () => {
    const onClearServerError = vi.fn();
    render(
      <AppointmentDateTimeModal
        {...defaultProps}
        serverError="Esse horário não está mais disponível."
        onClearServerError={onClearServerError}
      />,
    );

    fireEvent.change(screen.getByLabelText("Data e hora"), {
      target: { value: "2099-09-20T14:30" },
    });

    expect(onClearServerError).toHaveBeenCalledOnce();
  });

  it.each(["2099-09-20T14:30:45.123-03:00", "2099-11-01T06:30:00.000Z"])(
    "prefills and preserves the exact original ISO %s when unchanged",
    async (initialValue) => {
      const onSubmit = vi.fn();
      render(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} onSubmit={onSubmit} />);
      expect((screen.getByLabelText("Data e hora") as HTMLInputElement).value).toBe(isoToLocalDateTimeInput(initialValue));
      fireEvent.click(screen.getByRole("button", { name: defaultProps.submitLabel }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(initialValue));
    },
  );

  it("converts edited local values with the browser's chosen DST offset", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentDateTimeModal {...defaultProps} initialValue="2099-11-01T06:30:00.000Z" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2099-11-01T01:45" } });
    fireEvent.click(screen.getByRole("button", { name: defaultProps.submitLabel }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(new Date("2099-11-01T01:45").toISOString()));
  });

  it("validates an unchanged past proposal and associates its error with the field", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentDateTimeModal {...defaultProps} initialValue="2000-01-01T00:00:00.000Z" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: defaultProps.submitLabel }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Selecione uma data e hora futuras");
    expect(screen.getByLabelText("Data e hora").getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.getByLabelText("Data e hora").getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("associates the backend conflict with the datetime field", () => {
    render(<AppointmentDateTimeModal {...defaultProps} initialValue="2099-09-20T17:30:00.000Z" serverError="Escolha outro horário." />);
    const alert = screen.getByRole("alert");
    expect(alert.id).toBeTruthy();
    expect(screen.getByLabelText("Data e hora").getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("resets edited values when reopened with the proposal and handles invalid initial ISO", () => {
    const initialValue = "2099-09-20T17:30:00.000Z";
    const view = render(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} />);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2099-09-21T10:00" } });
    view.rerender(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} open={false} />);
    view.rerender(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} />);
    expect((screen.getByLabelText("Data e hora") as HTMLInputElement).value).toBe(isoToLocalDateTimeInput(initialValue));
    view.rerender(<AppointmentDateTimeModal {...defaultProps} initialValue="invalid" />);
    expect((screen.getByLabelText("Data e hora") as HTMLInputElement).value).toBe("");
  });

  it("guards duplicate form submits even before a busy prop arrives", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<AppointmentDateTimeModal {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2099-09-20T14:30" } });
    const form = screen.getByRole("button", { name: defaultProps.submitLabel }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    resolve();
    await waitFor(() => expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it.each(["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"])("retains either DST instant after edit and revert: %s", async (initialValue) => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-14T00:00:00.000Z").getTime());
    const onSubmit = vi.fn();
    render(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2026-11-02T10:00" } });
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: isoToLocalDateTimeInput(initialValue) } });
    fireEvent.click(screen.getByRole("button", { name: defaultProps.submitLabel }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(initialValue));
  });

  it("validates the original seconds instead of the truncated displayed minute", async () => {
    const initialValue = "2026-10-20T17:30:45.123Z";
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-20T17:30:30.000Z").getTime());
    const onSubmit = vi.fn();
    render(<AppointmentDateTimeModal {...defaultProps} initialValue={initialValue} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: defaultProps.submitLabel }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(initialValue));
  });

  it("captures and restores the opener without an explicit ref under StrictMode", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Propor horário</button>
        <AppointmentDateTimeModal {...defaultProps} open={open} onOpenChange={setOpen} />
      </>;
    }
    render(<StrictMode><Harness /></StrictMode>);
    const trigger = screen.getByRole("button", { name: "Propor horário" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2099-09-20T14:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
