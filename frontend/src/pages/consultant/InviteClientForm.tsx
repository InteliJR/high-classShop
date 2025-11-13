// Formulário para convidar um novo cliente

import React, { useState } from "react";
import Button from "../../components/ui/button";
import { inviteClient } from "../../services/consultant.service";

interface InviteClientFormProps {
  onSuccess: () => void;
}

export default function InviteClientForm({ onSuccess }: InviteClientFormProps) {
  // Guarda o valor do campo "Email"
  const [email, setEmail] = useState("");
  // Controla se o formulário está a ser enviado
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio
  const [error, setError] = useState<string | null>(null);
  // Guarda o link de convite retornado pela API
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  // Guarda a mensagem de warning se o email não foi enviado
  const [warning, setWarning] = useState<string | null>(null);
  // Controla se o link foi copiado
  const [linkCopied, setLinkCopied] = useState(false);

  /**
   * Função chamada quando o utilizador clica no botão "Enviar Convite"
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!email) {
      setError("Email é obrigatório.");
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
    setInviteLink(null);
    setWarning(null);
    setLinkCopied(false);

    try {
      const response = await inviteClient(email);
      
      // Set the invite link from the API response
      if (response.registrationLink) {
        setInviteLink(response.registrationLink);
      }
      
      // Check if there's a warning (email not sent)
      if (response.warning) {
        setWarning(response.warning);
      }
      
      // Don't close the modal - let user copy the link first
    } catch (err) {
      setError(
        (err as Error).message || "Falha ao enviar convite. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Função para copiar o link de convite para a área de transferência
   */
  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      
      // Reset the "copied" state after 3 seconds
      setTimeout(() => {
        setLinkCopied(false);
      }, 3000);
    } catch (err) {
      alert("Erro ao copiar o link. Por favor, copie manualmente.");
    }
  };

  /**
   * Função para fechar o modal após o convite ser enviado
   */
  const handleClose = () => {
    setEmail("");
    setInviteLink(null);
    setWarning(null);
    setLinkCopied(false);
    setError(null);
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <h2 className="h2-style">Convidar Novo Cliente</h2>

      {!inviteLink ? (
        // Formulário de convite
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary"
            >
              Email do Cliente
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
              placeholder="cliente@exemplo.com"
              required
              disabled={isSubmitting}
            />
            <p className="mt-2 text-sm text-text-secondary">
              Um email com o link de cadastro será enviado para este endereço.
            </p>
          </div>

          {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo */}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Botão de submissão */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </div>
        </form>
      ) : (
        // Tela de sucesso com link de convite
        <div className="space-y-6">
          {warning ? (
            // Warning quando email não foi enviado
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">
                ⚠️ {warning}
              </p>
              <p className="text-yellow-700 text-sm mt-1">
                O link foi gerado, mas não conseguimos enviar por email. Compartilhe-o manualmente com <strong>{email}</strong>.
              </p>
            </div>
          ) : (
            // Sucesso quando email foi enviado
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                ✓ Convite enviado com sucesso!
              </p>
              <p className="text-green-700 text-sm mt-1">
                Um email foi enviado para <strong>{email}</strong> com o link de cadastro.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Link de Convite
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 border border-brand-border rounded-md bg-gray-50 text-sm"
              />
              <Button type="button" onClick={handleCopyLink}>
                {linkCopied ? "✓ Copiado!" : "Copiar Link"}
              </Button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Você também pode compartilhar este link manualmente com o cliente.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

