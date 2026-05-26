// Formulário de convite de especialista (modal admin).

import { useState } from "react";
import Button from "../../components/ui/button";
import { Copy, Check } from "lucide-react";
import {
  inviteSpecialist,
  type Specialist,
} from "../../services/specialists.service";

interface NewSpecialistFormProps {
  onSuccess: () => void;
  specialistToEdit?: Specialist | null;
}

export default function NewSpecialistForm({
  onSuccess,
  specialistToEdit,
}: NewSpecialistFormProps) {
  const [email, setEmail] = useState("");
  const [speciality, setSpeciality] = useState<"CAR" | "BOAT" | "AIRCRAFT">("CAR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Caminho de edição não é mais suportado por esta entrada (o especialista
  // gerencia seu próprio perfil após o cadastro via convite).
  if (specialistToEdit) {
    return (
      <div className="space-y-6 text-center">
        <h2 className="h2-style">Editar Especialista</h2>
        <p className="text-text-secondary">
          A edição de especialistas será feita pelo próprio especialista nas
          configurações de perfil.
        </p>
        <div className="flex justify-center pt-2">
          <Button type="button" onClick={onSuccess}>
            OK
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await inviteSpecialist(email.trim(), speciality);
      setInviteLink(result.inviteLink);
    } catch (err) {
      setError(
        (err as Error).message || "Erro ao gerar convite. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (inviteLink) {
    return (
      <div className="space-y-4">
        <h2 className="h2-style">Convidar Especialista</h2>
        <p className="text-sm text-green-700 font-medium">
          Link de convite gerado! Envie para o especialista:
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <span className="text-xs text-gray-700 truncate flex-1 font-mono">
            {inviteLink}
          </span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
            title="Copiar link"
            type="button"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          O link expira em 7 dias. Um e-mail também foi enviado automaticamente.
        </p>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onSuccess}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">Convidar Especialista</h2>
      <p className="text-sm text-gray-500">
        O especialista receberá um link para concluir o cadastro (nome, CPF,
        RG, senha e dados bancários).
      </p>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-text-secondary"
        >
          E-mail do especialista
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="especialista@exemplo.com"
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
          autoFocus
        />
      </div>

      <div>
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

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Gerando..." : "Gerar convite"}
        </Button>
      </div>
    </form>
  );
}
