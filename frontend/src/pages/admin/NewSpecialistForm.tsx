// Formulário para criar um novo especialista dentro do modal

import React, { useState, useEffect } from "react";
import Button from "../../components/ui/button";
import { createSpecialist, updateSpecialist, type Specialist } from "../../services/specialists.service";

interface NewSpecialistFormProps {
  onSuccess: () => void;
  specialistToEdit?: Specialist | null;
}

export default function NewSpecialistForm({ onSuccess, specialistToEdit }: NewSpecialistFormProps) {
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
  const [speciality, setSpeciality] = useState<"CAR" | "BOAT" | "AIRCRAFT">("CAR");
  // Controla se o formulário está a ser enviado, para desativar o botão e evitar cliques duplos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio.
  const [error, setError] = useState<string | null>(null);

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
    } else {
      setName("");
      setSurname("");
      setEmail("");
      setCpf("");
      setRg("");
      setPasswordHash("");
      setSpeciality("CAR");
    }
  }, [specialistToEdit]);

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Especialista".
   * É responsável por validar, preparar e enviar os dados para a API.
   * Suporta tanto criação quanto edição de especialistas.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !surname || !email || !cpf || !rg || !password_hash) {
      setError("Todos os campos são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (specialistToEdit) {
        // Modo de edição
        await updateSpecialist(specialistToEdit.id, { name, surname, email, cpf, rg, password_hash, speciality });
      } else {
        // Modo de criação - envia como JSON
        console.log("Enviando dados:", { name, surname, email, cpf, rg, password_hash, speciality });
        await createSpecialist({ name, surname, email, cpf, rg, password_hash, speciality });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro capturado:", err);
      setError(
        (err as Error).message || "Falha ao salvar o especialista. Tente novamente."
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
          onChange={(e) => setSpeciality(e.target.value as "CAR" | "BOAT" | "AIRCRAFT")}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        >
          <option value="CAR">Carros</option>
          <option value="BOAT">Barcos</option>
          <option value="AIRCRAFT">Aeronaves</option>
        </select>
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
              : "Salvar Especialista"
          }
        </Button>
      </div>
    </form>
  );
}

