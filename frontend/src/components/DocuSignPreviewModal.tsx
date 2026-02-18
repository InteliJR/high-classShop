import { useEffect, useState, useCallback, useRef } from "react";
import { X, Clock, AlertTriangle, Loader, Send, XCircle } from "lucide-react";

interface DocuSignPreviewModalProps {
  previewUrl: string;
  envelopeId: string;
  expiresAt: string;
  onConfirm: () => void;
  onCancel: () => void;
  onExpired: () => void;
  isLoading?: boolean;
}

/**
 * Modal para exibir o DocuSign Sender View em um iframe
 *
 * Features:
 * - Exibe o preview do contrato em iframe fullscreen
 * - Mostra timer de expiração (URL expira em 10 min)
 * - Escuta eventos do DocuSign via postMessage
 * - Botões de confirmar/cancelar
 */
export default function DocuSignPreviewModal({
  previewUrl,
  envelopeId,
  expiresAt,
  onConfirm,
  onCancel,
  onExpired,
  isLoading = false,
}: DocuSignPreviewModalProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Calcular tempo restante
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining("Expirado");
        onExpired();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes < 2) {
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      } else {
        setTimeRemaining(`${minutes} min`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // Escutar eventos do DocuSign via postMessage
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validar origem (aceitar docusign.net e demo.docusign.net)
      if (
        !event.origin.includes("docusign.net") &&
        !event.origin.includes("docusign.com") &&
        !event.origin.includes(window.location.origin)
      ) {
        return;
      }

      console.log("[DocuSignPreview] Message received:", event.data);

      // Formato da mensagem pode variar
      const data = event.data;
      if (typeof data === "string") {
        // Mensagem de texto simples
        if (data === "send" || data === "signing_complete") {
          onConfirm();
        } else if (data === "cancel" || data === "decline") {
          onCancel();
        }
      } else if (typeof data === "object" && data !== null) {
        // Mensagem estruturada
        const eventType = data.event || data.type || data.action;
        if (eventType === "send" || eventType === "signing_complete") {
          onConfirm();
        } else if (
          eventType === "cancel" ||
          eventType === "decline" ||
          eventType === "sessionEnd"
        ) {
          onCancel();
        }
      }
    },
    [onConfirm, onCancel],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isLoading]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      {/* Container principal */}
      <div className="relative w-full h-full max-w-7xl max-h-[95vh] mx-4 my-4 bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-800">
              Pré-visualização do Contrato
            </h2>
            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              Envelope: {envelopeId.slice(0, 8)}...
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                isExpired
                  ? "bg-red-100 text-red-700"
                  : timeRemaining.includes(":")
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {isExpired ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">{timeRemaining}</span>
            </div>

            {/* Botão fechar */}
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
              title="Cancelar (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Iframe container */}
        <div className="flex-1 relative bg-slate-100">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-4">
                <Loader className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-slate-600 font-medium">
                  Carregando preview do contrato...
                </p>
              </div>
            </div>
          )}

          {isExpired ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-4 text-center px-8">
                <AlertTriangle className="w-16 h-16 text-red-500" />
                <h3 className="text-xl font-semibold text-slate-800">
                  Preview Expirado
                </h3>
                <p className="text-slate-600 max-w-md">
                  A URL de preview expirou após 10 minutos. Por favor, gere um
                  novo preview para continuar.
                </p>
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition font-medium"
                >
                  Fechar e Tentar Novamente
                </button>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0"
              title="DocuSign Contract Preview"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          )}
        </div>

        {/* Footer com botões de ação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <div className="text-sm text-slate-500">
            <p>
              Revise o contrato acima. Você pode editar os campos antes de
              enviar.
            </p>
            <p className="text-xs mt-1">
              Use o botão "Enviar" acima ou confirme abaixo quando estiver
              pronto.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition font-medium disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading || isExpired}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isLoading ? "Enviando..." : "Confirmar e Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
