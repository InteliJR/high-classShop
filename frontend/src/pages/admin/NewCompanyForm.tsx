import React, { useState } from "react";
import Button from "../../components/ui/Button";
import { createCompany } from "../../services/companies.service";

interface NewCompanyFormProps {
  onSuccess: () => void;
}

export default function NewCompanyForm({ onSuccess }: NewCompanyFormProps) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !cnpj) {
      setError("Nome e CNPJ são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("cnpj", cnpj);
    if (logo) {
      formData.append("logo", logo);
    }

    try {
      await createCompany(formData);

      onSuccess();
    } catch (err) {
      setError(
        (err as Error).message || "Falha ao criar a empresa. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">Novo Escritório</h2>

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-text-secondary"
        >
          Nome do Escritório
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        <label
          htmlFor="cnpj"
          className="block text-sm font-medium text-text-secondary"
        >
          CNPJ
        </label>
        <input
          id="cnpj"
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        <label
          htmlFor="logo"
          className="block text-sm font-medium text-text-secondary"
        >
          Logo
        </label>
        <input
          id="logo"
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setLogo(e.target.files[0]);
            }
          }}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-brand-dark hover:file:bg-gray-200 cursor-pointer"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Escritório"}
        </Button>
      </div>
    </form>
  );
}
