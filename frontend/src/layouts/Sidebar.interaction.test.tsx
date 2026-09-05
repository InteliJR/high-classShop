/** @vitest-environment jsdom */

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppContext, type AppContextProps } from "../contexts/AppContext";
import type { CompanyBranding, UserProps } from "../types/types";
import Header from "./Header";
import Sidebar from "./Sidebar";

const state = vi.hoisted(() => ({
  user: null as UserProps | null,
  whitelabelCompany: {
    id: "company-1",
    name: "AXBR Investimentos",
    logoUrl: "https://cdn.example.com/axbr.png",
  } as CompanyBranding | null,
}));

vi.mock("../hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("../store/authStateManager", () => ({
  useAuth: (selector?: (value: { user: UserProps | null }) => unknown) => {
    const value = { user: state.user };
    return selector ? selector(value) : value;
  },
}));
vi.mock("../store/whitelabelStore", () => ({
  useWhitelabel: (
    selector: (value: { company: CompanyBranding | null }) => unknown,
  ) => selector({ company: state.whitelabelCompany }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Rota atual">{location.pathname}</output>;
}

function MobileNavigationHarness() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const appContext: AppContextProps = {
    isSidebarCollapsed,
    setSidebarCollapsed,
    isSidebarDesktopCollapsed: false,
    toggleSidebarDesktopCollapsed: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
  };

  return (
    <MemoryRouter initialEntries={["/catalog/boats"]}>
      <AppContext.Provider value={appContext}>
        <Header />
        <Sidebar />
        <LocationProbe />
      </AppContext.Provider>
    </MemoryRouter>
  );
}

describe("Sidebar mobile interactions", () => {
  beforeEach(() => {
    document.body.style.overflow = "clip";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("navega pela logo white-label e fecha o drawer", async () => {
    const user = userEvent.setup();
    render(<MobileNavigationHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    const dialog = screen.getByRole("dialog", { name: "Menu principal" });
    const brandLink = within(dialog).getByRole("link", {
      name: "Ir para o catálogo de carros",
    });

    expect(brandLink.getAttribute("href")).toBe("/catalog/cars");
    expect(within(dialog).getByAltText("AXBR Investimentos")).not.toBeNull();

    await user.click(brandLink);

    await waitFor(() => {
      expect(dialog.getAttribute("aria-hidden")).toBe("true");
      expect(screen.getByLabelText("Rota atual").textContent).toBe(
        "/catalog/cars",
      );
    });
  });

  it("gerencia foco, teclado, estado inerte e scroll durante o drawer", async () => {
    const user = userEvent.setup();
    render(<MobileNavigationHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    const sidebar = document.getElementById("main-sidebar");

    expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar?.hasAttribute("inert")).toBe(true);

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Menu principal" });
    const closeButton = within(dialog).getByRole("button", {
      name: "Fechar menu",
    });
    const lastLink = within(dialog).getByRole("link", { name: "Login" });

    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    expect(dialog.hasAttribute("aria-hidden")).toBe(false);
    expect(dialog.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");

    lastLink.focus();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastLink);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Abrir menu" }),
      );
    });
    expect(sidebar?.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("clip");
  });
});
