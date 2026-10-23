// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoCalendlySchedulingActions from "./NoCalendlySchedulingActions";

afterEach(cleanup);

describe("NoCalendlySchedulingActions", () => {
  it("offers one request action and explains that the chosen time is a proposal", () => {
    const onRequest = vi.fn();
    render(<NoCalendlySchedulingActions onRequest={onRequest} />);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar reunião" }));
    expect(onRequest).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText(/confirmação do especialista/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar e-mail" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Escolher data e hora" }),
    ).toBeNull();
  });

  it("disables the request action while busy", () => {
    const onRequest = vi.fn();
    render(<NoCalendlySchedulingActions onRequest={onRequest} busy />);
    const button = screen.getByRole("button", {
      name: "Solicitar reunião",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onRequest).not.toHaveBeenCalled();
  });
});
