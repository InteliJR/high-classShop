import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Linha de contato copiável usada no ProcessCard.
 *
 * O texto e o ícone são o mesmo botão: a task pede que tocar em qualquer um
 * dos dois copie, e um botão único evita duas áreas de toque disputando espaço
 * no card em telas pequenas.
 *
 * Quem chama decide se renderiza — este componente não trata ausência de
 * valor, justamente para não existir uma linha vazia na tela.
 */
interface Props {
  /** Ícone do tipo de contato (envelope, telefone). */
  icon: React.ReactNode;
  /** Texto exibido — pode ser formatado (ex.: telefone com máscara). */
  label: string;
  /** Valor efetivamente copiado — cru, sem formatação. */
  value: string;
  /** Descrição para leitores de tela, ex.: "e-mail do cliente". */
  description: string;
}

export default function CopyableContact({
  icon,
  label,
  value,
  description,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evita setState depois de desmontado: o card some da lista enquanto a
  // confirmação ainda está no ar.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    // O card inteiro é clicável em algumas telas; copiar não deve navegar.
    e.stopPropagation();
    e.preventDefault();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // Clipboard indisponível (contexto não seguro, permissão negada).
      // Falhar em silêncio deixaria o usuário achando que copiou.
      setFailed(true);
      setCopied(false);
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar ${description}`}
      aria-label={`Copiar ${description}: ${label}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
    >
      <span className="shrink-0 text-gray-400 group-hover:text-gray-600">
        {icon}
      </span>
      <span className="truncate">{label}</span>

      {/* aria-live: o leitor de tela anuncia a confirmação sem mover o foco. */}
      <span className="shrink-0" aria-live="polite">
        {copied ? (
          <span className="inline-flex items-center gap-1 font-medium text-green-600">
            <Check size={12} />
            Copiado
          </span>
        ) : failed ? (
          <span className="font-medium text-red-600">Não foi possível copiar</span>
        ) : (
          <Copy
            size={12}
            className="text-gray-300 transition-colors group-hover:text-gray-500"
          />
        )}
      </span>
    </button>
  );
}
