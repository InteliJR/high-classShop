// frontend/src/services/consultants.service.ts

const API = "http://localhost:3000";

export type Consultant = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  company_id: string;
};

// Busca a lista completa de consultores na API.
export async function getConsultants(): Promise<Consultant[]> {
  const res = await fetch(`${API}/consultants`);
  return res.json();
}

// Cria um novo consultor enviando os dados para a API.
export async function createConsultant(data: {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  company_id?: string;
}): Promise<Consultant> {
  const API_URL = "http://localhost:3000";

  const response = await fetch(`${API_URL}/consultants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Erro ao criar consultor:", errorData);
    throw new Error(errorData.message || "Falha ao criar o consultor.");
  }

  return response.json();
}

// Atualiza os dados de um consultor existente.
export async function updateConsultant(
  id: string,
  data: Partial<Consultant>
): Promise<Consultant> {
  const res = await fetch(`${API}/consultants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Apaga um consultor pelo seu ID.
export async function deleteConsultant(id: string): Promise<void> {
  await fetch(`${API}/consultants/${id}`, { method: "DELETE" });
}

