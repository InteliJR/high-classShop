// frontend/src/services/companies.service.ts

const API = 'http://localhost:3000';

export type Company = {
  id: number;
  name: string;
  cnpj: string;
  logo?: string | null;
  description?: string | null;
};

export async function getCompanies(): Promise<Company[]> {
  const res = await fetch(`${API}/companies`);
  return res.json();
}

export async function createCompany(data: { name: string; cnpj: string }): Promise<Company> {
  const res = await fetch(`${API}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCompany(id: number, data: Partial<Company>): Promise<Company> {
  const res = await fetch(`${API}/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCompany(id: number): Promise<void> {
  await fetch(`${API}/companies/${id}`, { method: 'DELETE' });
}