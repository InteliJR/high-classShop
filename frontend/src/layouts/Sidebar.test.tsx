import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { CompanyBranding, UserProps } from "../types/types";
import { AppContext, type AppContextProps } from "../contexts/AppContext";
import Sidebar from "./Sidebar";

const state = vi.hoisted(() => ({
  user: null as UserProps | null,
  whitelabelCompany: null as CompanyBranding | null,
}));

vi.mock("../hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("../store/authStateManager", () => ({
  useAuth: (selector: (value: { user: UserProps | null }) => unknown) =>
    selector({ user: state.user }),
}));
vi.mock("../store/whitelabelStore", () => ({
  useWhitelabel: (
    selector: (value: { company: CompanyBranding | null }) => unknown,
  ) => selector({ company: state.whitelabelCompany }),
}));

function renderSidebar(isOpen = true) {
  const appContext: AppContextProps = {
    isSidebarCollapsed: isOpen,
    setSidebarCollapsed: vi.fn(),
    isSidebarDesktopCollapsed: false,
    toggleSidebarDesktopCollapsed: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
  };

  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/catalog/cars"]}>
      <AppContext.Provider value={appContext}>
        <Sidebar />
      </AppContext.Provider>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    state.user = null;
    state.whitelabelCompany = null;
    vi.clearAllMocks();
  });

  it("renderiza marca e destinos públicos para visitante white-label", () => {
    state.whitelabelCompany = {
      id: "company-1",
      name: "AXBR Investimentos",
      logoUrl: "https://cdn.example.com/axbr.png",
    };

    const html = renderSidebar();

    expect(html).toContain('src="https://cdn.example.com/axbr.png"');
    expect(html).toContain('href="/catalog/cars"');
    expect(html).toContain('href="/catalog/boats"');
    expect(html).toContain('href="/catalog/aircrafts"');
    expect(html).toContain('href="/register"');
    expect(html).toContain('href="/login"');
  });

  it("mantém os destinos autenticados do usuário OFFICE", () => {
    state.user = {
      id: "office-1",
      name: "Gerente",
      surname: "Teste",
      email: "office@example.com",
      cpf: "00000000000",
      rg: "000000000",
      role: "OFFICE",
      company: { id: "company-1", name: "AXBR Investimentos" },
    };

    const html = renderSidebar();

    expect(html).toContain('href="/office/dashboard"');
    expect(html).toContain('href="/office/consultants"');
    expect(html).toContain('href="/office/clients"');
    expect(html).toContain('href="/office/processes"');
    expect(html).toContain('href="/office/company"');
    expect(html).not.toContain('href="/login"');
  });

  it("remove o drawer mobile fechado da navegação assistiva", () => {
    const html = renderSidebar(false);

    expect(html).toContain('id="main-sidebar"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("inert");
  });
});
