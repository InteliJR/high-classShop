import api from "./api";

export interface DashboardStats {
  activeProcesses: number;
  conversionRate: number;
  activeCompanies: number;
  salesByMonth: MonthData[];
  consultantsPerformance: ConsultantPerformanceData[];
}

export interface MonthData {
  month: string;
  vendidos: number;
  naoVendidos: number;
}

export interface StatusData {
  name: string;
  value: number;
}

export interface ConsultantPerformanceData {
  [key: string]: string | number;
  name: string;
  value: number;
  percentage: number;
}

export interface SpecialistDashboardStats {
  productsListed: number;
  activeProcesses: number;
  completedSales: number;
  conversionRate: number;
  salesByMonth: MonthData[];
  processesByStatus: StatusData[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await api.get("/dashboard/stats");
    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    throw new Error(
      error.response?.data?.message ||
        "Erro ao buscar estatísticas do dashboard",
    );
  }
}

export async function getSpecialistDashboardStats(
  specialistId: string,
): Promise<SpecialistDashboardStats> {
  try {
    const response = await api.get(
      `/dashboard/specialist-stats/${specialistId}`,
    );
    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas do especialista:", error);
    throw new Error(
      error.response?.data?.message ||
        "Erro ao buscar estatísticas do especialista",
    );
  }
}
