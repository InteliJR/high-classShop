// frontend/src/services/companies.service.ts
import api from "./api";

export type Company = {
  id: string;
  name: string;
  cnpj: string;
  logo?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};

// Tipo auxiliar para criação (geralmente não enviamos ID ou logoUrl na criação)
type CreateCompanyDto = {
  name: string;
  cnpj: string;
  logo?: string;
};

// Busca a lista completa de empresas.
export async function getCompanies(): Promise<Company[]> {
  const { data } = await api.get<Company[]>("/companies");
  return data;
}

// Cria uma nova empresa.
export async function createCompany(data: CreateCompanyDto): Promise<Company> {
  // O Axios já converte o body para JSON automaticamente e injeta o Content-Type
  const { data: newCompany } = await api.post<Company>("/companies", data);
  return newCompany;
}

// Atualiza os dados de uma empresa existente.
export async function updateCompany(
  id: string,
  data: Partial<Company>
): Promise<Company> {
  const { data: updatedCompany } = await api.put<Company>(`/companies/${id}`, data);
  return updatedCompany;
}

// Apaga uma empresa pelo seu ID.
export async function deleteCompany(id: string): Promise<void> {
  await api.delete(`/companies/${id}`);
}