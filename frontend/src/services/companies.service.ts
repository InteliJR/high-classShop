// frontend/src/services/companies.service.ts
import api from "./api";
import axios from "axios";
import type { PaginationMeta } from "../types/types";

export type Company = {
  id: string;
  name: string;
  cnpj: string;
  logo?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  commission_rate?: number | null;
  bank?: string | null;
  agency?: string | null;
  checking_account?: string | null;
  specialists_count?: number;
};

export type CompanySpecialist = {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
  speciality: string | null;
  commission_rate: number | null;
  calendly_url: string | null;
  created_at: string;
};

export type CompanySpecialistsResponse = {
  data: CompanySpecialist[];
  pagination: PaginationMeta;
};

// Tipo auxiliar para criação (geralmente não enviamos ID ou logoUrl na criação)
type CreateCompanyDto = {
  name: string;
  cnpj: string;
  logo?: string;
  commission_rate?: number;
  bank?: string;
  agency?: string;
  checking_account?: string;
};

// Função auxiliar para extrair mensagem de erro
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Erro de resposta da API
    if (error.response?.data?.message) {
      if (Array.isArray(error.response.data.message)) {
        return error.response.data.message.join(", ");
      }
      return error.response.data.message;
    }
    // Erro de rede
    if (error.message) {
      return error.message;
    }
  }
  return "Erro desconhecido. Tente novamente.";
}

// Busca a lista completa de empresas.
export async function getCompanies(): Promise<Company[]> {
  try {
    const { data } = await api.get<Company[]>("/companies");
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Cria uma nova empresa.
export async function createCompany(data: CreateCompanyDto): Promise<Company> {
  try {
    const { data: newCompany } = await api.post<Company>("/companies", data);
    return newCompany;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Atualiza os dados de uma empresa existente.
export async function updateCompany(
  id: string,
  data: Partial<Company>,
): Promise<Company> {
  try {
    const { data: updatedCompany } = await api.put<Company>(
      `/companies/${id}`,
      data,
    );
    return updatedCompany;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Apaga uma empresa pelo seu ID.
export async function deleteCompany(id: string): Promise<void> {
  try {
    await api.delete(`/companies/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Busca especialistas de uma empresa com paginação (lazy loading).
export async function getCompanySpecialists(
  companyId: string,
  page: number = 1,
  perPage: number = 5,
): Promise<CompanySpecialistsResponse> {
  try {
    const { data } = await api.get<CompanySpecialistsResponse>(
      `/companies/${companyId}/specialists`,
      { params: { page, perPage } },
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
