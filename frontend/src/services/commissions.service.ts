import api from "./api";

export type SaleCommission = {
  processId: string;
  productType: string | null;
  productLabel: string;
  clientName: string;
  specialistName: string;
  saleValue: number;
  totalCommission: number;
  totalCommissionRate: number; // % da venda
  specialistValue: number;
  officeName: string | null;
  officeValue: number; // 0 quando não há escritório
  platformValue: number;
  restante: number; // escritório + plataforma
  signedAt: string | null;
};

// Fluxo de comissão por venda (ADMIN) — lido do snapshot dos contratos.
export async function getSalesCommissions(): Promise<SaleCommission[]> {
  const { data } = await api.get<SaleCommission[]>("commissions/sales");
  return data;
}
