// frontend/src/services/specialists.service.ts

const API = "http://localhost:3000";

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

// Busca a lista completa de especialistas na API.
export async function getSpecialists(): Promise<Specialist[]> {
  const res = await fetch(`${API}/specialists`);
  return res.json();
}

// Cria um novo especialista enviando os dados para a API.
export async function createSpecialist(data: {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  speciality: "CAR" | "BOAT" | "AIRCRAFT";
}): Promise<Specialist> {
  const API_URL = "http://localhost:3000";

  const response = await fetch(`${API_URL}/specialists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Erro ao criar especialista:", errorData);
    throw new Error(errorData.message || "Falha ao criar o especialista.");
  }

  return response.json();
}

// Atualiza os dados de um especialista existente.
export async function updateSpecialist(
  id: string,
  data: Partial<Specialist>
): Promise<Specialist> {
  const res = await fetch(`${API}/specialists/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Apaga um especialista pelo seu ID.
export async function deleteSpecialist(id: string): Promise<void> {
  await fetch(`${API}/specialists/${id}`, { method: "DELETE" });
}

