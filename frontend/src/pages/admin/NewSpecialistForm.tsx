// Formulário para criar um novo especialista dentro do modal

import React, { useState, useEffect } from "react";
import Button from "../../components/ui/button";
import {
  createSpecialist,
  updateSpecialist,
  type Specialist,
} from "../../services/specialists.service";
import { getCompanies, type Company } from "../../services/companies.service";

interface NewSpecialistFormProps {
  onSuccess: () => void;
  specialistToEdit?: Specialist | null;
}

export default function NewSpecialistForm({
  onSuccess,
  specialistToEdit,
}: NewSpecialistFormProps) {
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
  // Guarda o valor do campo "Especialidade".
  const [speciality, setSpeciality] = useState<"CAR" | "BOAT" | "AIRCRAFT">(
    "CAR",
  );
  // Empresa (escritório) vinculada ao especialista (opcional)
  const [companyId, setCompanyId] = useState("");
  // Lista de empresas para o dropdown
  const [companies, setCompanies] = useState<Company[]>([]);
  // Taxa de comissão individual (somente se não for vinculado a empresa)
  const [commissionRate, setCommissionRate] = useState("");
  // Dados bancários do especialista
  const [bank, setBank] = useState("");
  const [agency, setAgency] = useState("");
  const [checkingAccount, setCheckingAccount] = useState("");
  // Link do Calendly para agendamentos
  const [calendlyUrl, setCalendlyUrl] = useState("");
  // Controla se o formulário está a ser enviado, para desativar o botão e evitar cliques duplos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio.
  const [error, setError] = useState<string | null>(null);

  // Carrega lista de empresas para o dropdown
  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {});
  }, []);

  // Preenche o formulário com os dados do especialista sendo editado
  useEffect(() => {
    if (specialistToEdit) {
      setName(specialistToEdit.name);
      setSurname(specialistToEdit.surname);
      setEmail(specialistToEdit.email);
      setCpf(specialistToEdit.cpf);
      setRg(specialistToEdit.rg);
      setPasswordHash(specialistToEdit.password_hash);
      setSpeciality(specialistToEdit.speciality);
      setCompanyId(specialistToEdit.company_id || "");
      setCommissionRate(
        specialistToEdit.commission_rate != null
          ? String(specialistToEdit.commission_rate)
          : "",
      );
      setBank(specialistToEdit.bank || "");
      setAgency(specialistToEdit.agency || "");
      setCheckingAccount(specialistToEdit.checking_account || "");
      setCalendlyUrl(specialistToEdit.calendly_url || "");
    } else {
      setName("");
      setSurname("");
      setEmail("");
      setCpf("");
      setRg("");
      setPasswordHash("");
      setSpeciality("CAR");
      setCompanyId("");
      setCommissionRate("");
      setBank("");
      setAgency("");
      setCheckingAccount("");
      setCalendlyUrl("");
    }
  }, [specialistToEdit]);

  /**
   * Valida o formato do CPF (apenas números, 11 dígitos)
   */
  const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, "");
    return cleanCPF.length === 11;
  };

  /**
   * Valida o formato do RG (apenas números, 9 dígitos)
   */
  const validateRG = (rg: string): boolean => {
    const cleanRG = rg.replace(/\D/g, "");
    return cleanRG.length === 9;
  };

  /**
   * Valida o formato do email
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Especialista".
   * É responsável por validar, preparar e enviar os dados para a API.
   * Suporta tanto criação quanto edição de especialistas.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validações
    if (!name || !surname || !email || !cpf || !rg || !password_hash) {
      setError("Todos os campos são obrigatórios.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Email inválido.");
      return;
    }

    if (!validateCPF(cpf)) {
      setError("CPF deve conter exatamente 11 dígitos numéricos.");
      return;
    }

    if (!validateRG(rg)) {
      setError("RG deve conter exatamente 9 dígitos numéricos.");
      return;
    }

    if (password_hash.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Remove formatação do CPF e RG antes de enviar
      const cleanCPF = cpf.replace(/\D/g, "");
      const cleanRG = rg.replace(/\D/g, "");

      if (specialistToEdit) {
        // Modo de edição
        await updateSpecialist(specialistToEdit.id, {
          name,
          surname,
          email,
          cpf: cleanCPF,
          rg: cleanRG,
          password_hash,
          speciality,
          company_id: companyId || undefined,
          commission_rate: commissionRate
            ? parseFloat(commissionRate)
            : undefined,
          bank: bank || undefined,
          agency: agency || undefined,
          checking_account: checkingAccount || undefined,
          calendly_url: calendlyUrl || undefined,
        });
      } else {
        // Modo de criação
        await createSpecialist({
          name,
          surname,
          email,
          cpf: cleanCPF,
          rg: cleanRG,
          password_hash,
          speciality,
          company_id: companyId || undefined,
          commission_rate: commissionRate
            ? parseFloat(commissionRate)
            : undefined,
          bank: bank || undefined,
          agency: agency || undefined,
          checking_account: checkingAccount || undefined,
          calendly_url: calendlyUrl || undefined,
        });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro capturado:", err);
      setError(
        (err as Error).message ||
          "Falha ao salvar o especialista. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">
        {specialistToEdit ? "Editar Especialista" : "Novo Especialista"}
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
          CPF (apenas números)
        </label>
        <input
          id="cpf"
          type="text"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="12345678901"
          maxLength={14}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Digite 11 dígitos numéricos
        </p>
      </div>

      <div>
        {/* --- CAMPO RG --- */}
        <label
          htmlFor="rg"
          className="block text-sm font-medium text-text-secondary"
        >
          RG (apenas números)
        </label>
        <input
          id="rg"
          type="text"
          value={rg}
          onChange={(e) => setRg(e.target.value)}
          placeholder="123456789"
          maxLength={9}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Digite 9 dígitos numéricos</p>
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
          minLength={6}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
      </div>

      <div>
        {/* --- CAMPO ESPECIALIDADE --- */}
        <label
          htmlFor="speciality"
          className="block text-sm font-medium text-text-secondary"
        >
          Especialidade
        </label>
        <select
          id="speciality"
          value={speciality}
          onChange={(e) =>
            setSpeciality(e.target.value as "CAR" | "BOAT" | "AIRCRAFT")
          }
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        >
          <option value="CAR">Carros</option>
          <option value="BOAT">Embarcações</option>
          <option value="AIRCRAFT">Aeronaves</option>
        </select>
      </div>

      <div>
        {/* --- CAMPO EMPRESA (ESCRITÓRIO) --- */}
        <label
          htmlFor="company_id"
          className="block text-sm font-medium text-text-secondary"
        >
          Escritório (opcional)
        </label>
        <select
          id="company_id"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            // Se selecionou empresa, limpa comissão individual
            if (e.target.value) {
              setCommissionRate("");
            }
          }}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
        >
          <option value="">Sem escritório</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{" "}
              {c.commission_rate != null ? `(${c.commission_rate}%)` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Se vinculado a um escritório, usará a taxa de comissão do escritório.
        </p>
      </div>

      {/* --- CAMPO TAXA DE COMISSÃO (somente se sem empresa) --- */}
      {!companyId && (
        <div>
          <label
            htmlFor="commission_rate"
            className="block text-sm font-medium text-text-secondary"
          >
            Taxa de Comissão Individual (%)
          </label>
          <input
            id="commission_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
            placeholder="Ex: 10.00"
            className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          />
          <p className="text-xs text-gray-500 mt-1">
            Opcional. Se vazio, usará a taxa padrão da plataforma.
          </p>
        </div>
      )}

      {/* --- LINK DO CALENDLY --- */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          Calendário de Agendamentos
        </h3>
        <div>
          <label
            htmlFor="calendly_url"
            className="block text-sm font-medium text-text-secondary"
          >
            Link do Calendly
          </label>
          <input
            id="calendly_url"
            type="url"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/seu-usuario/reuniao"
            className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          />
          <p className="text-xs text-gray-500 mt-1">
            URL do Calendly para que clientes possam agendar reuniões com este
            especialista. Pode ser configurado depois pelo próprio especialista
            no perfil.
          </p>
        </div>
      </div>

      {/* --- DADOS BANCÁRIOS --- */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          Dados Bancários (para recebimento de comissão)
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="bank"
              className="block text-sm font-medium text-text-secondary"
            >
              Banco
            </label>
            <input
              id="bank"
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Ex: Banco do Brasil, Itaú, etc."
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="agency"
                className="block text-sm font-medium text-text-secondary"
              >
                Agência
              </label>
              <input
                id="agency"
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="Ex: 1234"
                maxLength={10}
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
              />
            </div>

            <div>
              <label
                htmlFor="checking_account"
                className="block text-sm font-medium text-text-secondary"
              >
                Conta Corrente
              </label>
              <input
                id="checking_account"
                type="text"
                value={checkingAccount}
                onChange={(e) => setCheckingAccount(e.target.value)}
                placeholder="Ex: 12345-6"
                maxLength={20}
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Os dados bancários serão usados para recebimento da comissão do especialista nos contratos.
          </p>
        </div>
      </div>

      {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo. */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* --- BOTÃO DE SUBMISSÃO --- */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : specialistToEdit
              ? "Atualizar Especialista"
              : "Salvar Especialista"}
        </Button>
      </div>
    </form>
  );
}
