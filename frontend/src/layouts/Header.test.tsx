import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { CompanyBranding } from "../types/types";
import { AppContext, type AppContextProps } from "../contexts/AppContext";
import Header from "./Header";

const state = vi.hoisted(() => ({
  whitelabelCompany: {
    id: "company-1",
    name: "AXBR Investimentos",
    logoUrl: "https://cdn.example.com/axbr.png",
  } as CompanyBranding,
}));

vi.mock("../hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("../store/authStateManager", () => ({
  useAuth: () => ({ user: null }),
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
});
