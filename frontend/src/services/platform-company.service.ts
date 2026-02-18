// frontend/src/services/platform-company.service.ts
import api from "./api";
import axios from "axios";

export type PlatformCompany = {
  id: string;
  name: string;
  cnpj: string;
  bank: string;
  agency: string;
  checking_account: string;
  address?: string | null;
  cep?: string | null;
  default_commission_rate: number;
  created_at: string;
  updated_at: string;
};

export type UpdatePlatformCompanyData = {
  name: string;
  cnpj: string;
  bank: string;
  agency: string;
  checking_account: string;
  address?: string;
  cep?: string;
  default_commission_rate: number;
};

// Função auxiliar para extrair mensagem de erro
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.message) {
      if (Array.isArray(error.response.data.message)) {
        return error.response.data.message.join(", ");
      }
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
  }
  return "Erro desconhecido. Tente novamente.";
}

// Busca os dados da empresa da plataforma
export async function getPlatformCompany(): Promise<PlatformCompany | null> {
  try {
    const { data } = await api.get<PlatformCompany>("/platform-company");
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Atualiza os dados da empresa da plataforma
export async function updatePlatformCompany(
  data: UpdatePlatformCompanyData,
): Promise<PlatformCompany> {
  try {
    const { data: updated } = await api.put<PlatformCompany>(
      "/platform-company",
      data,
    );
    return updated;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
