// frontend/src/services/specialists.service.ts
import api from "./api";

export type Specialist = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  speciality: "CAR" | "BOAT" | "AIRCRAFT";
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
};

// Busca a lista completa de especialistas na API.
export async function getSpecialists(): Promise<Specialist[]> {
  const { data } = await api.get<Specialist[]>("/specialists");
  return data;
}

// Busca especialistas agrupados por categoria.
export async function getSpecialistsGroupedByCategory(): Promise<GroupedSpecialists> {
  const { data } = await api.get<GroupedSpecialists>("/specialists/grouped-by-category");
  return data;
}

// Cria um novo especialista enviando os dados para a API.
export async function createSpecialist(data: CreateSpecialistData): Promise<Specialist> {
  // Axios gerencia automaticamente o JSON.stringify e os headers
  const { data: newSpecialist } = await api.post<Specialist>("/specialists", data);
  return newSpecialist;
}

// Atualiza os dados de um especialista existente.
export async function updateSpecialist(
  id: string,
  data: Partial<Specialist>
): Promise<Specialist> {
  const { data: updatedSpecialist } = await api.put<Specialist>(
    `/specialists/${id}`,
    data
  );
  return updatedSpecialist;
}

// Apaga um especialista pelo seu ID.
export async function deleteSpecialist(id: string): Promise<void> {
  await api.delete(`/specialists/${id}`);
}