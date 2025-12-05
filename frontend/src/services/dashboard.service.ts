import api from "./api";

export interface DashboardStats {
  activeProcesses: number;
  conversionRate: number;
  activeCompanies: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await api.get("/dashboard/stats");
    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    throw new Error(
      error.response?.data?.message || "Erro ao buscar estatísticas do dashboard"
    );
  }
}

