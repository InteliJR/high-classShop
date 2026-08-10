import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import Button from "../../components/ui/button";

/**
 * Página de callback para o DocuSign Sender View
 *
 * Esta página é usada como returnUrl para o DocuSign.
 * Quando o usuário realiza uma ação no Sender View (enviar, cancelar, etc),
 * o DocuSign redireciona para esta página com parâmetros de evento.
 *
 * A página então usa postMessage para comunicar com a janela pai (iframe)
 * e permite fechar o preview automaticamente.
 *
 * Query params esperados:
 * - event: send | save | cancel | error | sessionEnd
 * - envelopeId: ID do envelope
 */
export default function ContractPreviewCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<
    "loading" | "success" | "cancelled" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const event = searchParams.get("event");
    const envelopeId = searchParams.get("envelopeId");

    console.log("[PreviewCallback] Event:", event, "EnvelopeId:", envelopeId);

    // Determinar status baseado no evento
    switch (event) {
      case "send":
      case "signing_complete":
        setStatus("success");
        setMessage("Contrato enviado com sucesso!");
        // Comunicar com iframe pai
        if (window.parent !== window) {
          window.parent.postMessage(
            { event: "send", envelopeId },
            window.location.origin,
          );
        }
        break;

      case "save":
        setStatus("success");
        setMessage("Rascunho salvo. Você pode enviar depois.");
        if (window.parent !== window) {
          window.parent.postMessage(
            { event: "save", envelopeId },
            window.location.origin,
          );
        }
        break;

      case "cancel":
      case "decline":
        setStatus("cancelled");
        setMessage("Envio cancelado pelo usuário.");
        if (window.parent !== window) {
          window.parent.postMessage(
            { event: "cancel", envelopeId },
            window.location.origin,
          );
        }
        break;

      case "sessionEnd":
        setStatus("cancelled");
        setMessage("Sessão expirada. Por favor, gere um novo preview.");
        if (window.parent !== window) {
          window.parent.postMessage(
            { event: "sessionEnd", envelopeId },
            window.location.origin,
          );
        }
        break;

      case "error":
        setStatus("error");
        setMessage("Ocorreu um erro ao processar o contrato.");
        if (window.parent !== window) {
          window.parent.postMessage(
            { event: "error", envelopeId },
            window.location.origin,
          );
        }
        break;

      default:
        // Se não tiver parâmetro de evento, pode ser que a página foi
        // acessada diretamente ou o DocuSign não enviou o parâmetro
        setStatus("loading");
        setMessage("Processando...");

        // Tentar fechar após um curto delay
        setTimeout(() => {
          if (window.parent !== window) {
            window.parent.postMessage(
              { event: "unknown", envelopeId },
              window.location.origin,
            );
          }
        }, 1000);
        break;
    }
  }, [searchParams]);

  const navigate = useNavigate();

  // Tentar fechar a janela/tab se aberta em popup; se não for popup
  // (acesso direto à URL, ou postMessage/iframe falhou), navega de volta
  // em vez de deixar a tela sem nenhuma saída.
  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate("/specialist/processes");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-ink mb-2">
              Processando...
            </h1>
            <p className="text-muted">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-ink mb-2">
              Sucesso!
            </h1>
            <p className="text-muted mb-6">{message}</p>
            <p className="text-sm text-muted mb-4">
              Esta janela será fechada automaticamente...
            </p>
            <Button type="button" variant="light" onClick={() => navigate("/specialist/processes")}>
              Voltar para processos
            </Button>
          </>
        )}

        {status === "cancelled" && (
          <>
            <XCircle className="w-16 h-16 text-subtle mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-ink mb-2">
              Cancelado
            </h1>
            <p className="text-muted mb-6">{message}</p>
            <Button type="button" onClick={handleClose}>Fechar</Button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-ink mb-2">Erro</h1>
            <p className="text-muted mb-6">{message}</p>
            <Button type="button" onClick={handleClose}>Fechar</Button>
          </>
        )}
      </div>
    </div>
  );
}
