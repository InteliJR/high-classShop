// frontend/src/services/companies.service.ts

const API = "http://localhost:3000";

export type Company = {
  id: string;
  name: string;
  cnpj: string;
  logo?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};

// Busca a lista completa de empresas na API.
export async function getCompanies(): Promise<Company[]> {
  const res = await fetch(`${API}/companies`);
  return res.json();
}

// Cria uma nova empresa enviando os dados para a API.
export async function createCompany(data: {
  name: string;
  cnpj: string;
  logo?: string;
}): Promise<Company> {
  const API_URL = "http://localhost:3000";

  const response = await fetch(`${API_URL}/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Erro ao criar empresa:", errorData);
    throw new Error(errorData.message || "Falha ao criar o escritório.");
  }

  return response.json();
}

// Atualiza os dados de uma empresa existente.
export async function updateCompany(
  id: string,
  data: Partial<Company>
): Promise<Company> {
  const res = await fetch(`${API}/companies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Apaga uma empresa pelo seu ID.
export async function deleteCompany(id: string): Promise<void> {
  await fetch(`${API}/companies/${id}`, { method: "DELETE" });
}
