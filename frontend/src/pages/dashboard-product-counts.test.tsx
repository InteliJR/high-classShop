// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "./admin/DashboardPage";
import SpecialistDashboard from "./specialist/SpecialistDashboard";
import { AppContext } from "../contexts/AppContext";
import {
  getDashboardStats,
  getSpecialistDashboardStats,
} from "../services/dashboard.service";

vi.mock("../services/dashboard.service", () => ({
  getDashboardStats: vi.fn(),
  getSpecialistDashboardStats: vi.fn(),
}));

vi.mock("../store/authStateManager", () => ({
  useAuth: (selector: (state: object) => unknown) =>
    selector({
      user: {
        id: "specialist-1",
        name: "Ana",
        speciality: "CAR",
      },
    }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
}));

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    LineChart: Chart,
    Line: Chart,
    XAxis: Chart,
    YAxis: Chart,
    CartesianGrid: Chart,
    Tooltip: Chart,
    Legend: Chart,
    ResponsiveContainer: Chart,
    PieChart: Chart,
    Pie: Chart,
    Cell: Chart,
  };
});

vi.mock("../components/commission/CommissionMiniCalculator", () => ({
  CommissionMiniCalculator: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("contagem de produtos nos dashboards", () => {
  it("destaca ativos e informa o total no dashboard administrativo", async () => {
    vi.mocked(getDashboardStats).mockResolvedValue({
      activeProcesses: 1,
      activeCompanies: 1,
      totalClients: 1,
      specialistsCount: 1,
      totalProducts: 13,
      activeProducts: 8,
      productsByType: { cars: 3, boats: 4, aircrafts: 6 },
      salesByMonth: [],
      consultantsPerformance: [],
      commissionSummary: {
        totalPaid: 0,
        thisMonth: 0,
        avgTicket: 0,
        recentSales: [],
      },
      databaseCounts: [],
    });

    render(
      <MemoryRouter>
        <AppContext.Provider
          value={{
            isSidebarCollapsed: false,
            setSidebarCollapsed: vi.fn(),
            isSidebarDesktopCollapsed: false,
            toggleSidebarDesktopCollapsed: vi.fn(),
            searchTerm: "",
            setSearchTerm: vi.fn(),
          }}
        >
          <DashboardPage />
        </AppContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Produtos ativos")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("13 produtos no total")).toBeTruthy();
  });

  it("destaca ativos e informa o total no dashboard do especialista", async () => {
    vi.mocked(getSpecialistDashboardStats).mockResolvedValue({
      productsListed: 5,
      activeProducts: 2,
      activeProcesses: 1,
      completedSales: 1,
      conversionRate: 50,
      salesByMonth: [],
      processesByStatus: [],
    });

    render(
      <MemoryRouter>
        <SpecialistDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Produtos ativos")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("5 produtos no total")).toBeTruthy();
  });
});
