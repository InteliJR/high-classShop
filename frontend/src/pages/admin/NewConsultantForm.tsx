// Formulário para criar um novo consultor dentro do modal

import React, { useState, useEffect } from "react";
import Button from "../../components/ui/button";
import { createConsultant, updateConsultant, type Consultant } from "../../services/consultants.service";
import { getCompanies, type Company } from "../../services/companies.service";

interface NewConsultantFormProps {
  onSuccess: () => void;
  consultantToEdit?: Consultant | null;
}

export default function NewConsultantForm({ onSuccess, consultantToEdit }: NewConsultantFormProps) {
  // Guarda o valor do campo "Nome".
  const [name, setName] = useState("");
  // Guarda o valor do campo "Sobrenome".
  const [surname, setSurname] = useState("");
  // Guarda o valor do campo "Email".
  const [email, setEmail] = useState("");
  // Guarda o valor do campo "CPF".
  const [cpf, setCpf] = useState("");
  // Guarda o valor do campo "RG".
  const [rg, setRg] = useState("");
  // Guarda o valor do campo "Senha".
  const [password_hash, setPasswordHash] = useState("");
  // Guarda o valor do campo "Empresa" (company_id).
  const [company_id, setCompanyId] = useState("");
  // Guarda a lista de empresas para o select.
  const [companies, setCompanies] = useState<Company[]>([]);
  // Controla se o formulário está a ser enviado, para desativar o botão e evitar cliques duplos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio.
  const [error, setError] = useState<string | null>(null);

  // Carrega a lista de empresas ao montar o componente
  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await getCompanies();
        setCompanies(data);
      } catch (err) {
        console.error("Erro ao carregar empresas:", err);
      }
    }
    loadCompanies();
  }, []);

  // Preenche o formulário com os dados do consultor sendo editado
  useEffect(() => {
    if (consultantToEdit) {
      setName(consultantToEdit.name);
      setSurname(consultantToEdit.surname);
      setEmail(consultantToEdit.email);
      setCpf(consultantToEdit.cpf);
      setRg(consultantToEdit.rg);
      setPasswordHash(consultantToEdit.password_hash);
      setCompanyId(consultantToEdit.company_id);
    } else {
      setName("");
      setSurname("");
      setEmail("");
      setCpf("");
      setRg("");
      setPasswordHash("");
      setCompanyId("");
    }
  }, [consultantToEdit]);

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Consultor".
   * É responsável por validar, preparar e enviar os dados para a API.
   * Suporta tanto criação quanto edição de consultores.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !surname || !email || !cpf || !rg || !password_hash || !company_id) {
      setError("Todos os campos são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (consultantToEdit) {
        // Modo de edição
        await updateConsultant(consultantToEdit.id, { name, surname, email, cpf, rg, password_hash, company_id });
      } else {
        // Modo de criação - envia como JSON
        console.log("Enviando dados:", { name, surname, email, cpf, rg, password_hash, company_id });
        await createConsultant({ name, surname, email, cpf, rg, password_hash, company_id });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro capturado:", err);
      setError(
        (err as Error).message || "Falha ao salvar o consultor. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">
        {consultantToEdit ? "Editar Consultor" : "Novo Consultor"}
      </h2>

      <div>
        {/* --- CAMPO NOME --- */}
        <label
          htmlFor="name"
          className="block text-sm font-medium text-text-secondary"
        >
          Nome
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
        {/* --- CAMPO SOBRENOME --- */}
        <label
          htmlFor="surname"
          className="block text-sm font-medium text-text-secondary"
        >
          Sobrenome
        </label>
        <input
          id="surname"
          type="text"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO EMAIL --- */}
        <label
          htmlFor="email"
          className="block text-sm font-medium text-text-secondary"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO CPF --- */}
        <label
          htmlFor="cpf"
          className="block text-sm font-medium text-text-secondary"
        >
          CPF
        </label>
        <input
          id="cpf"
          type="text"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO RG --- */}
        <label
          htmlFor="rg"
          className="block text-sm font-medium text-text-secondary"
        >
          RG
        </label>
        <input
          id="rg"
          type="text"
          value={rg}
          onChange={(e) => setRg(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO SENHA --- */}
        <label
          htmlFor="password_hash"
          className="block text-sm font-medium text-text-secondary"
        >
          Senha
        </label>
        <input
          id="password_hash"
          type="password"
          value={password_hash}
          onChange={(e) => setPasswordHash(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO EMPRESA --- */}
        <label
          htmlFor="company_id"
          className="block text-sm font-medium text-text-secondary"
        >
          Empresa
        </label>
        <select
          id="company_id"
          value={company_id}
          onChange={(e) => setCompanyId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        >
          <option value="">Selecione uma empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo. */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* --- BOTÃO DE SUBMISSÃO --- */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : consultantToEdit
              ? "Atualizar Consultor"
              : "Salvar Consultor"
          }
        </Button>
      </div>
    </form>
  );
}

