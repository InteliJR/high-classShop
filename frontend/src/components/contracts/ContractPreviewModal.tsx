import { useEffect, useState } from "react";
import { X, Clock, Loader, Send, XCircle, FileText, ZoomIn, ZoomOut, Download } from "lucide-react";

interface ContractPreviewModalProps {
  pdfBase64: string;
  envelopeId: string;
  expiresAt: string;
  onConfirm: () => void;
  onCancel: () => void;
  onExpired: () => void;
  isLoading?: boolean;
}

/**
 * Modal para exibir preview do contrato em PDF
 *
 * Features:
 * - Exibe o PDF diretamente no browser (nativo)
 * - Mostra timer de expiração (24h)
 * - Controles de zoom
 * - Botão de download
 * - Botões de confirmar/cancelar
 */
export default function ContractPreviewModal({
  pdfBase64,
  envelopeId,
  expiresAt,
  onConfirm,
  onCancel,
  onExpired,
  isLoading = false,
}: ContractPreviewModalProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Criar URL do PDF a partir do base64
  const pdfUrl = `data:application/pdf;base64,${pdfBase64}`;

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

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}min`);
      } else {
        setTimeRemaining(`${minutes} min`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

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

  // Handler para download do PDF
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `contrato-${envelopeId.slice(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={!isLoading ? onCancel : undefined}>
      {/* Container principal */}
      <div className="relative w-full h-full max-w-7xl max-h-[95vh] mx-4 my-4 bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">
              Pré-visualização do Contrato
            </h2>
            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              Envelope: {envelopeId.slice(0, 8)}...
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Controles de zoom */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                className="p-1 hover:bg-slate-200 rounded"
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-1 hover:bg-slate-200 rounded"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Botão download */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              title="Baixar PDF"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Baixar</span>
            </button>

            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                isExpired
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              <Clock className="w-4 h-4" />
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

        {/* PDF Viewer */}
        <div className="flex-1 relative bg-slate-200 overflow-auto">
          {!pdfLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-4">
                <Loader className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-slate-600 font-medium">
                  Carregando contrato...
                </p>
              </div>
            </div>
          )}

          <div 
            className="flex justify-center p-4"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full bg-white shadow-lg"
              style={{ height: '100vh', maxWidth: '900px' }}
              onLoad={() => setPdfLoaded(true)}
            >
              {/* Fallback para browsers que não suportam PDF inline */}
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                style={{ height: '100vh', maxWidth: '900px' }}
                title="Contract Preview"
                onLoad={() => setPdfLoaded(true)}
              />
            </object>
          </div>
        </div>

        {/* Footer com botões de ação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <div className="text-sm text-slate-500">
            <p className="font-medium text-slate-700">
              Revise o contrato acima antes de enviar.
            </p>
            <p className="text-xs mt-1">
              Após confirmar, o contrato será enviado para assinatura digital via DocuSign.
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
