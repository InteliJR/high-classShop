// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppContext, type AppContextProps } from "../contexts/AppContext";
import {
  AuthContext,
  type AuthContextProps,
} from "../contexts/AuthContext";
import { getCalendlyOAuthStatus } from "../services/appointments.service";
import MainLayout from "./MainLayout";

const state = vi.hoisted(() => ({
  user: {
    id: "specialist-1",
    name: "Especialista",
    surname: "Teste",
    email: "specialist@example.com",
    cpf: "12345678000199",
    rg: "123456789",
    role: "SPECIALIST" as const,
    speciality: "CAR" as const,
  },
}));

vi.mock("./Header", () => ({ default: () => <header>Cabeçalho</header> }));
vi.mock("./Sidebar", () => ({ default: () => <aside>Menu</aside> }));
vi.mock("../hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../store/authStateManager", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("../services/appointments.service", () => ({
  getCalendlyOAuthStatus: vi.fn().mockResolvedValue({
    connected: false,
    calendly_user_uri: null,
    expires_at: null,
    is_active: false,
  }),
  getCalendlyAuthorizeUrl: vi.fn(),
}));

const appContext: AppContextProps = {
  isSidebarCollapsed: false,
  setSidebarCollapsed: vi.fn(),
  isSidebarDesktopCollapsed: false,
  toggleSidebarDesktopCollapsed: vi.fn(),
  searchTerm: "",
  setSearchTerm: vi.fn(),
};

const authContext: AuthContextProps = {
  user: state.user,
  accessToken: "token",
  login: vi.fn(),
  register: vi.fn(),
  validateReferralToken: vi.fn(),
  logout: vi.fn(),
  loading: false,
  refreshUser: vi.fn(),
  verifyToken: vi.fn(),
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("MainLayout", () => {
  it("não consulta nem bloqueia o especialista com um modal global do Calendly", async () => {
    render(
      <AuthContext.Provider value={authContext}>
        <AppContext.Provider value={appContext}>
          <MainLayout>
            <div>Formulário de produto</div>
          </MainLayout>
        </AppContext.Provider>
      </AuthContext.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Formulário de produto")).toBeTruthy();
    expect(getCalendlyOAuthStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: /Conecte seu Calendly/i }),
    ).toBeNull();
  });
});
