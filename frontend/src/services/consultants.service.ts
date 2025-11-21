// frontend/src/services/consultants.service.ts
import api from "./api";

export type Consultant = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password: string; // Geralmente o backend não retorna a hash por segurança, mas mantive conforme seu código
  company_id: string;
};

// Tipo para os dados de criação (DTO)
export type CreateConsultantData = {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password: string;
  company_id?: string;
};

// Busca a lista completa de consultores na API.
export async function getConsultants(): Promise<Consultant[]> {
  const { data } = await api.get<Consultant[]>("/consultants");
  return data;
}

// Cria um novo consultor enviando os dados para a API.
export async function createConsultant(data: CreateConsultantData): Promise<Consultant> {
  console.log("No front rota de criar consultor")
  // O Axios converte o objeto data para JSON automaticamente
  const { data: newConsultant } = await api.post<Consultant>("/consultants", data);
  return newConsultant;
}

// Atualiza os dados de um consultor existente.
export async function updateConsultant(
  id: string,
  data: Partial<Consultant>
): Promise<Consultant> {
  const { data: updatedConsultant } = await api.put<Consultant>(
    `/consultants/${id}`,
    data
  );
  return updatedConsultant;
}

// Apaga um consultor pelo seu ID.
export async function deleteConsultant(id: string): Promise<void> {
  await api.delete(`/consultants/${id}`);
}