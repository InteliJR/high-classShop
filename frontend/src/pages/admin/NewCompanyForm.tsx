// Fotmulário para criar um novo escritório dentro do modal

import React, { useState, useEffect } from "react";
import Button from "../../components/ui/button";
import { createCompany, updateCompany, type Company } from "../../services/companies.service";

interface NewCompanyFormProps {
  onSuccess: () => void;
  companyToEdit?: Company | null;
}

export default function NewCompanyForm({ onSuccess, companyToEdit }: NewCompanyFormProps) {
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

  // Preenche o formulário com os dados da empresa sendo editada
  useEffect(() => {
    if (companyToEdit) {
      setName(companyToEdit.name);
      setCnpj(companyToEdit.cnpj);
    } else {
      setName("");
      setCnpj("");
      setLogo(null);
    }
  }, [companyToEdit]);

  /**
   * Converte um arquivo File para base64 string.
   * Necessário para enviar a imagem do logo como JSON para o backend.
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove o prefixo "data:image/...;base64," para enviar apenas o base64
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Valida o formato do CNPJ (apenas números, 14 dígitos)
   */
  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    return cleanCNPJ.length === 14;
  };

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Escritório".
   * É responsável por validar, preparar e enviar os dados para a API.
   * Suporta tanto criação quanto edição de empresas.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validações
    if (!name || !cnpj) {
      setError("Nome e CNPJ são obrigatórios.");
      return;
    }

    if (!validateCNPJ(cnpj)) {
      setError("CNPJ deve conter exatamente 14 dígitos numéricos.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Remove formatação do CNPJ antes de enviar
      const cleanCNPJ = cnpj.replace(/\D/g, '');

      if (companyToEdit) {
        // Modo de edição
        await updateCompany(companyToEdit.id, { name, cnpj: cleanCNPJ });
      } else {
        // Modo de criação - converte logo para base64 se existir
        let logoBase64: string | undefined;
        if (logo) {
          logoBase64 = await fileToBase64(logo);
        }

        await createCompany({ name, cnpj: cleanCNPJ, logo: logoBase64 });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro capturado:", err);
      setError(
        (err as Error).message || "Falha ao salvar a empresa. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">
        {companyToEdit ? "Editar Escritório" : "Novo Escritório"}
      </h2>

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
          CNPJ (apenas números)
        </label>
        <input
          id="cnpj"
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="12345678901234"
          maxLength={18}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Digite 14 dígitos numéricos</p>
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
          {isSubmitting
            ? "Salvando..."
            : companyToEdit
              ? "Atualizar Escritório"
              : "Salvar Escritório"
          }
        </Button>
      </div>
    </form>
  );
}
