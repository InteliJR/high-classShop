// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";
import { useAuth } from "../../store/authStateManager";
import { getUserById, updateUser, type UserProfile } from "../../services/users.service";
import { getCalendlyOAuthStatus } from "../../services/appointments.service";
import { getMyAdvisor } from "../../services/advisor.service";
import type { UserProps } from "../../types/types";

vi.mock("../../services/users.service", () => ({ getUserById: vi.fn(), updateUser: vi.fn() }));
vi.mock("../../services/appointments.service", () => ({ getCalendlyOAuthStatus: vi.fn(), getCalendlyAuthorizeUrl: vi.fn(), disconnectCalendlyOAuth: vi.fn() }));
vi.mock("../../services/advisor.service", () => ({ getMyAdvisor: vi.fn(), inviteAdvisor: vi.fn(), removeAdvisor: vi.fn() }));

const profile: UserProfile = { id: "user-1", name: "Ana", surname: "Silva", email: "ana@example.com", role: "SPECIALIST", cpf: "12345678900", rg: "12345678", phone: "11987654321", civil_state: null, speciality: "CAR", calendly_url: "https://calendly.com/ana/reuniao", created_at: "2026-01-01T00:00:00.000Z" };
function renderPage(role: UserProps["role"] = "SPECIALIST") {
  useAuth.setState({ user: { id: profile.id, name: profile.name, surname: profile.surname, email: profile.email, cpf: profile.cpf, rg: profile.rg, role } });
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>);
}

describe("ProfilePage Calendly payload", () => {
  beforeEach(() => {
    vi.mocked(getUserById).mockResolvedValue(profile);
    vi.mocked(updateUser).mockResolvedValue(profile);
    vi.mocked(getCalendlyOAuthStatus).mockResolvedValue({ connected: false, calendly_user_uri: null, expires_at: null, is_active: false });
    vi.mocked(getMyAdvisor).mockResolvedValue(null);
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); useAuth.setState({ user: null }); });

  it.each(["", "   "])("sends null when a specialist clears Calendly with %j", async (value) => {
    renderPage();
    const input = await screen.findByPlaceholderText("https://calendly.com/seu-usuario");
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(profile.id, expect.objectContaining({ calendly_url: null })));
  });

  it("sends the trimmed specialist URL", async () => {
    renderPage();
    const input = await screen.findByPlaceholderText("https://calendly.com/seu-usuario");
    fireEvent.change(input, { target: { value: "https://calendly.com/ana/novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(profile.id, expect.objectContaining({ calendly_url: "https://calendly.com/ana/novo" })));
  });

  it("shows webhook degradation without presenting OAuth as disconnected", async () => {
    vi.mocked(getCalendlyOAuthStatus).mockResolvedValue({
      connected: true,
      calendly_user_uri: "https://api.calendly.com/users/1",
      expires_at: null,
      is_active: true,
      last_error: "webhook_subscription_failed",
    });

    renderPage();

    expect(await screen.findByText("Status: Conectado")).toBeTruthy();
    expect(
      screen.getByText(/sincronização automática.*degradada/i),
    ).toBeTruthy();
  });

  it.each(["CUSTOMER", "CONSULTANT", "OFFICE", "ADMIN"] as const)("never sends calendly_url for %s even if the loaded profile has a URL", async (role) => {
    renderPage(role);
    const save = await screen.findByRole("button", { name: "Salvar Alterações" });
    expect(screen.queryByPlaceholderText("https://calendly.com/seu-usuario")).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(updateUser).toHaveBeenCalledOnce());
    expect(Object.hasOwn(vi.mocked(updateUser).mock.calls[0][1], "calendly_url")).toBe(false);
    expect(getUserById).toHaveBeenCalledWith(profile.id);
  });
});
