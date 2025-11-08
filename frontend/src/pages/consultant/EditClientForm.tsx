// Formulário para editar um cliente existente

import React, { useState } from "react";
import Button from "../../components/ui/button";
import { updateClient, type Client } from "../../services/consultant.service";

interface EditClientFormProps {
  client: Client;
  onSuccess: () => void;
}

export default function EditClientForm({ client, onSuccess }: EditClientFormProps) {
  // Guarda os valores dos campos do formulário
  const [name, setName] = useState(client.name);
  const [surname, setSurname] = useState(client.surname);
  const [email, setEmail] = useState(client.email);
  
  // Controla se o formulário está a ser enviado
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio
  const [error, setError] = useState<string | null>(null);

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Alterações"
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!name || !surname || !email) {
      setError("Nome, sobrenome e email são obrigatórios.");
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, insira um email válido.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Call PUT /api/consultant/clients/:id
      await updateClient(client.id, {
        name,
        surname,
        email,
      });
      
      onSuccess();
    } catch (err) {
      setError(
        (err as Error).message || "Falha ao atualizar cliente. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">Editar Cliente</h2>

      <div>
        {/* Campo Nome */}
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
          disabled={isSubmitting}
        />
      </div>

      <div>
        {/* Campo Sobrenome */}
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
          disabled={isSubmitting}
        />
      </div>

      <div>
        {/* Campo Email */}
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
          disabled={isSubmitting}
        />
      </div>

      {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Botões de ação */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

