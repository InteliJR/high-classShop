// frontend/src/services/consultants.service.ts
import api from "./api";
import axios from "axios";

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

// Função auxiliar para extrair mensagem de erro
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Erro de resposta da API
    if (error.response?.data?.message) {
      if (Array.isArray(error.response.data.message)) {
        return error.response.data.message.join(', ');
      }
      return error.response.data.message;
    }
    // Erro de rede
    if (error.message) {
      return error.message;
    }
  }
  return 'Erro desconhecido. Tente novamente.';
}

// Busca a lista completa de consultores na API.
export async function getConsultants(): Promise<Consultant[]> {
  try {
    const { data } = await api.get<Consultant[]>("/consultants");
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Cria um novo consultor enviando os dados para a API.
export async function createConsultant(data: CreateConsultantData): Promise<Consultant> {
  try {
    const { data: newConsultant } = await api.post<Consultant>("/consultants", data);
    return newConsultant;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Atualiza os dados de um consultor existente.
export async function updateConsultant(
  id: string,
  data: Partial<Consultant>
): Promise<Consultant> {
  try {
    const { data: updatedConsultant } = await api.put<Consultant>(
      `/consultants/${id}`,
      data
    );
    return updatedConsultant;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Apaga um consultor pelo seu ID.
export async function deleteConsultant(id: string): Promise<void> {
  try {
    await api.delete(`/consultants/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}