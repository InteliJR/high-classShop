// frontend/src/pages/CompaniesPage.tsx

import { useEffect, useState } from "react";
import {
  type Company,
  getCompanies,
  createCompany,
  deleteCompany,
  updateCompany,
} from "../../services/companies.service";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");

  // Agora a função `load` é mais limpa
  async function load() {
    const data = await getCompanies();
    setCompanies(data);
  }

  // A função de criação também fica mais simples
  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !cnpj) return;

    await createCompany({ name, cnpj });

    setName("");
    setCnpj("");
    await load(); // Recarrega a lista
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      style={{ maxWidth: 760, margin: "32px auto", fontFamily: "sans-serif" }}
    >
      <h1>Companies</h1>

      <form
        onSubmit={handleCreateCompany}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="CNPJ"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {companies.map((c) => (
          <li
            key={c.id}
            style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <b>{c.name}</b> <small>({c.cnpj})</small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => {
                    await updateCompany(c.id, { name: c.name + " *" });
                    await load();
                  }}
                >
                  Quick Edit
                </button>
                <button
                  onClick={async () => {
                    await deleteCompany(c.id);
                    await load();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
