// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequireCalendlyModal from "./RequireCalendlyModal";
import { getCalendlyOAuthStatus } from "../../services/appointments.service";

vi.mock("../../store/authStateManager", () => ({
  useAuth: () => ({
    user: { id: "specialist-1", role: "SPECIALIST" },
  }),
}));

vi.mock("../../services/appointments.service", () => ({
  getCalendlyOAuthStatus: vi.fn(),
  getCalendlyAuthorizeUrl: vi.fn(),
}));

describe("RequireCalendlyModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(getCalendlyOAuthStatus).mockResolvedValue({
      connected: false,
      calendly_user_uri: null,
      expires_at: null,
      is_active: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains that Calendly is optional and allows continuing", async () => {
    render(<RequireCalendlyModal />);

    expect(
      await screen.findByRole("button", { name: "Continuar sem Calendly" }),
    ).toBeTruthy();
    expect(screen.getByText(/Calendly é opcional/i)).toBeTruthy();
    expect(screen.queryByText(/fica bloqueado/i)).toBeNull();
  });

  it("dismisses the reminder for the current browser session", async () => {
    render(<RequireCalendlyModal />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Continuar sem Calendly" }),
    );

    expect(sessionStorage.getItem("calendly-modal-dismissed-session")).toBe(
      "1",
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Continuar sem Calendly" }),
      ).toBeNull();
    });
  });
});
