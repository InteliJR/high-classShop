// Fotmulário para criar um novo escritório dentro do modal

import React, { useState } from "react";
import Button from "../../components/ui/button";
import { createCompany } from "../../services/companies.service";

interface NewCompanyFormProps {
  onSuccess: () => void;
}

export default function NewCompanyForm({ onSuccess }: NewCompanyFormProps) {
  // Guarda o valor do campo "Nome do Escritório".
  const [name, setName] = useState("");
  // Guarda o valor do campo "CNPJ".
  const [cnpj, setCnpj] = useState("");
  // Guarda o ficheiro de imagem selecionado pelo utilizador. Começa como nulo.
  const [logo, setLogo] = useState<File | null>(null);
  // Controla se o formulário está a ser enviado, para desativar o botão e evitar cliques duplos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio.
  const [error, setError] = useState<string | null>(null);

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Escritório".
   * É responsável por validar, preparar e enviar os dados para a API.
   */
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
        {/* --- CAMPO NOME --- */}
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
        {/* --- CAMPO CNPJ --- */}
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
        {/* --- CAMPO LOGO (UPLOAD DE FICHEIRO) --- */}
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

      {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo. */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* --- BOTÃO DE SUBMISSÃO --- */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Escritório"}
        </Button>
      </div>
    </form>
  );
}
