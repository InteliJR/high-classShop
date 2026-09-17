// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NoCalendlySchedulingActions from "./NoCalendlySchedulingActions";

describe("NoCalendlySchedulingActions", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers both scheduling paths and a permanent email fallback", async () => {
    const onEmail = vi.fn();
    const onChooseDateTime = vi.fn();
    render(
      <NoCalendlySchedulingActions
        specialistEmail="especialista@example.com"
        onEmail={onEmail}
        onChooseDateTime={onChooseDateTime}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar e-mail" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Escolher data e hora" }),
    );

    expect(onEmail).toHaveBeenCalledOnce();
    expect(onChooseDateTime).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "especialista@example.com" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copiar e-mail" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("especialista@example.com");
    });
    expect(await screen.findByText("E-mail copiado")).toBeTruthy();
  });

  it("disables both actions while a request is running", () => {
    render(
      <NoCalendlySchedulingActions
        specialistEmail="especialista@example.com"
        onEmail={vi.fn()}
        onChooseDateTime={vi.fn()}
        busy
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Enviar e-mail" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Escolher data e hora",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
