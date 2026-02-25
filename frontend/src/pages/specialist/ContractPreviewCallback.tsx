import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, Loader } from "lucide-react";

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

  // Tentar fechar a janela/tab se aberta em popup
  const handleClose = () => {
    if (window.opener) {
      window.close();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {status === "loading" && (
          <>
            <Loader className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Processando...
            </h1>
            <p className="text-slate-600">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Sucesso!
            </h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <p className="text-sm text-slate-500">
              Esta janela será fechada automaticamente...
            </p>
          </>
        )}

        {status === "cancelled" && (
          <>
            <XCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Cancelado
            </h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Fechar
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">Erro</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
