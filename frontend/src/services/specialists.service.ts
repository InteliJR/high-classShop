// frontend/src/services/specialists.service.ts
import api from "./api";
import axios from "axios";

export type Specialist = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  speciality: "CAR" | "BOAT" | "AIRCRAFT";
  company_id?: string | null;
  commission_rate?: number | null;
};

// Tipo para especialistas agrupados por categoria
export type GroupedSpecialists = {
  CAR: Specialist[];
  BOAT: Specialist[];
  AIRCRAFT: Specialist[];
};

// Tipo auxiliar para criação (DTO)
export type CreateSpecialistData = {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  speciality: "CAR" | "BOAT" | "AIRCRAFT";
  company_id?: string;
  commission_rate?: number;
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

// Busca a lista completa de especialistas na API.
export async function getSpecialists(): Promise<Specialist[]> {
  try {
    const { data } = await api.get<Specialist[]>("/specialists");
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Busca especialistas agrupados por categoria.
export async function getSpecialistsGroupedByCategory(): Promise<GroupedSpecialists> {
  const { data } = await api.get<GroupedSpecialists>(
    "/specialists/grouped-by-category",
  );
  return data;
}

// Cria um novo especialista enviando os dados para a API.
export async function createSpecialist(
  data: CreateSpecialistData,
): Promise<Specialist> {
  try {
    const { data: newSpecialist } = await api.post<Specialist>(
      "/specialists",
      data,
    );
    return newSpecialist;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Atualiza os dados de um especialista existente.
export async function updateSpecialist(
  id: string,
  data: Partial<Specialist>,
): Promise<Specialist> {
  try {
    const { data: updatedSpecialist } = await api.put<Specialist>(
      `/specialists/${id}`,
      data,
    );
    return updatedSpecialist;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Apaga um especialista pelo seu ID.
export async function deleteSpecialist(id: string): Promise<void> {
  try {
    await api.delete(`/specialists/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
