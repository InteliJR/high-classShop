import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { CompanyBranding, UserProps } from "../types/types";
import { AppContext, type AppContextProps } from "../contexts/AppContext";
import Header from "./Header";

const state = vi.hoisted(() => ({
  user: null as UserProps | null,
  whitelabelCompany: {
    id: "company-1",
    name: "AXBR Investimentos",
    logoUrl: "https://cdn.example.com/axbr.png",
  } as CompanyBranding,
}));

vi.mock("../hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("../store/authStateManager", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("../store/whitelabelStore", () => ({
  useWhitelabel: (
    selector: (value: { company: CompanyBranding | null }) => unknown,
  ) => selector({ company: state.whitelabelCompany }),
}));

const appContext: AppContextProps = {
  isSidebarCollapsed: false,
  setSidebarCollapsed: vi.fn(),
  isSidebarDesktopCollapsed: false,
  toggleSidebarDesktopCollapsed: vi.fn(),
  searchTerm: "",
  setSearchTerm: vi.fn(),
};

beforeEach(() => {
  state.user = null;
  vi.clearAllMocks();
});

describe("Header mobile", () => {
  it("expõe um botão acessível para abrir o drawer", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppContext.Provider value={appContext}>
          <Header />
        </AppContext.Provider>
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Abrir menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="main-sidebar"');
    expect(html).toContain('alt="AXBR Investimentos"');
  });

  it("leva a marca white-label do visitante ao catálogo de carros", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppContext.Provider value={appContext}>
          <Header />
        </AppContext.Provider>
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Ir para o catálogo de carros"');
    expect(html).toMatch(
      /aria-label="Ir para o catálogo de carros"[^>]*href="\/catalog\/cars"/,
    );
    expect(html).toContain('alt="AXBR Investimentos"');
  });

  it("leva a marca de um escritório autenticado ao dashboard", () => {
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

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppContext.Provider value={appContext}>
          <Header />
        </AppContext.Provider>
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Ir para o início"');
    expect(html).toMatch(
      /aria-label="Ir para o início"[^>]*href="\/office\/dashboard"/,
    );
  });
});
