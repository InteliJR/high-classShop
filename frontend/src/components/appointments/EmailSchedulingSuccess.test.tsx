// @vitest-environment jsdom

import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmailSchedulingSuccess from "./EmailSchedulingSuccess";
import { buildEmailSchedulingLinks } from "../../lib/email-scheduling";

const props = {
  appointmentId: "appointment-default",
  recipient: "especialista@example.com",
  specialistName: "Ana Silva",
  clientName: "João Cliente",
  productLabel: "Carro A&B?#",
  appointmentDatetime: "2099-10-20T17:30:00.000Z",
  timeZone: "America/Sao_Paulo",
};

describe("EmailSchedulingSuccess", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("announces the persisted proposal with every email and process fallback", () => {
    render(<EmailSchedulingSuccess {...props} />);
    const links = buildEmailSchedulingLinks(props);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(
      screen.getByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/aguardando confirmação do especialista/i),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Abrir aplicativo de e-mail" })
        .getAttribute("href"),
    ).toBe(links.mailtoHref);
    const gmail = screen.getByRole("link", { name: "Abrir no Gmail" });
    expect(gmail.getAttribute("href")).toBe(links.gmailHref);
    expect(gmail.getAttribute("target")).toBe("_blank");
    expect(gmail.getAttribute("rel")).toBe("noopener noreferrer");
    expect(
      screen
        .getByRole("link", { name: "Acompanhar processo" })
        .getAttribute("href"),
    ).toBe("/customer/processes");
    const address = screen.getByRole("textbox", {
      name: "E-mail do especialista",
    }) as HTMLInputElement;
    expect(address.value).toBe(props.recipient);
    expect(address.readOnly).toBe(true);
  });

  it("opens only after success is committed and focuses its heading", async () => {
    let committedAtOpen = false;
    let markerAtOpen: string | null = null;
    const openMailClient = vi.fn(() => {
      committedAtOpen = Boolean(screen.queryByRole("status"));
      markerAtOpen = sessionStorage.getItem(
        "email-request-opened:appointment-focus",
      );
    });
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-focus"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await waitFor(() => expect(openMailClient).toHaveBeenCalledOnce());
    expect(committedAtOpen).toBe(true);
    expect(markerAtOpen).toBe("1");
    expect(openMailClient).toHaveBeenCalledWith(
      buildEmailSchedulingLinks(props).mailtoHref,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    );
  });

  it("does not repeat automatic opening on rerender, StrictMode or remount", async () => {
    const openMailClient = vi.fn();
    const view = render(
      <StrictMode>
        <EmailSchedulingSuccess
          {...props}
          appointmentId="appointment-strict"
          autoOpen
          openMailClient={openMailClient}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(openMailClient).toHaveBeenCalledOnce());
    view.rerender(
      <StrictMode>
        <EmailSchedulingSuccess
          {...props}
          appointmentId="appointment-strict"
          autoOpen
          openMailClient={openMailClient}
        />
      </StrictMode>,
    );
    view.unmount();
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-strict"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openMailClient).toHaveBeenCalledOnce();
  });

  it("honors the session marker even on a first render in this module", async () => {
    sessionStorage.setItem("email-request-opened:appointment-session", "1");
    const openMailClient = vi.fn();
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-session"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openMailClient).not.toHaveBeenCalled();
  });

  it("recovers fallbacks without automatic opening or focus theft", async () => {
    const openMailClient = vi.fn();
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-recovered"
        autoOpen={false}
        openMailClient={openMailClient}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openMailClient).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem("email-request-opened:appointment-recovered"),
    ).toBeNull();
    expect(document.activeElement).not.toBe(
      screen.getByRole("heading", {
        name: "Solicitação de reunião registrada",
      }),
    );
    expect(
      screen.getByRole("link", { name: "Abrir aplicativo de e-mail" }),
    ).toBeTruthy();
  });

  it("keeps an in-memory one-shot across remount when session storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const openMailClient = vi.fn();
    const view = render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-no-storage"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await waitFor(() => expect(openMailClient).toHaveBeenCalledOnce());
    view.unmount();
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-no-storage"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openMailClient).toHaveBeenCalledOnce();
  });

  it("preserves fallbacks and the one-shot marker when the opener throws", async () => {
    const openMailClient = vi.fn(() => {
      throw new Error("mail app unavailable");
    });
    const view = render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-throw"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    await waitFor(() => expect(openMailClient).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir no Gmail" })).toBeTruthy();
    expect(
      sessionStorage.getItem("email-request-opened:appointment-throw"),
    ).toBe("1");
    view.rerender(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-throw"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    expect(openMailClient).toHaveBeenCalledOnce();
  });

  it("cancels an automatic attempt when the panel unmounts before it runs", async () => {
    const openMailClient = vi.fn();
    const view = render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-cancelled"
        autoOpen
        openMailClient={openMailClient}
      />,
    );
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openMailClient).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem("email-request-opened:appointment-cancelled"),
    ).toBeNull();
  });

  it("uses the browser mail client by default after committing the panel", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <EmailSchedulingSuccess
        {...props}
        appointmentId="appointment-browser"
        autoOpen
      />,
    );
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        buildEmailSchedulingLinks(props).mailtoHref,
        "_self",
      ),
    );
  });

  it("announces successful clipboard copying", async () => {
    render(<EmailSchedulingSuccess {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar e-mail" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(props.recipient),
    );
    expect(await screen.findByText("E-mail copiado")).toBeTruthy();
  });

  it.each(["unavailable", "rejected"])(
    "announces %s clipboard failure while preserving a selectable address",
    async (kind) => {
      if (kind === "unavailable")
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      else writeText.mockRejectedValue(new Error("denied"));
      render(<EmailSchedulingSuccess {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Copiar e-mail" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(
        /não foi possível copiar/i,
      );
      const address = screen.getByRole("textbox", {
        name: "E-mail do especialista",
      }) as HTMLInputElement;
      address.focus();
      address.select();
      expect(address.selectionEnd).toBe(props.recipient.length);
    },
  );
});
