import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import Button from "../../components/ui/button";
import {
  createClientInviteJob,
  getClientInviteJob,
  type InviteJobDetail,
} from "../../services/consultant.service";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  SENT: "Enviado",
  ACCEPTED: "Aceito",
  FAILED: "Falhou",
  DUPLICATE: "Duplicado",
};

export default function BatchInviteClients({
  onClose,
}: {
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<InviteJobDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setJob(null);
    try {
      const { jobId, pollIntervalMs } = await createClientInviteJob(file);
      const poll = async () => {
        try {
          const detail = await getClientInviteJob(jobId);
          setJob(detail);
          if (!detail.done) {
            setTimeout(poll, pollIntervalMs || 2000);
          } else {
            setUploading(false);
          }
        } catch (e) {
          setError((e as Error).message || "Erro ao acompanhar o envio.");
          setUploading(false);
        }
      };
      poll();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Falha no upload do CSV.");
      setUploading(false);
    }
  };

  return (
    <div className="w-[min(560px,90vw)]">
      <h2 className="h2-style mb-1">Convite de clientes em lote</h2>
      <p className="text-sm text-gray-500 mb-4">
        Envie um CSV com as colunas <b>name</b> e <b>email</b>. Cada cliente
        recebe o link de convite já vinculado a você.
      </p>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setJob(null);
          setError(null);
        }}
        className="block w-full text-sm mb-4 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:text-sm"
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!job && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <Button type="button" onClick={upload} disabled={!file || uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Enviar
          </Button>
        </div>
      )}

      {job && (
        <div>
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <span className="text-green-700">✓ {job.successItems} enviados</span>
            <span className="text-red-600">✗ {job.failedItems} falhas</span>
            <span className="text-gray-500">
              ↻ {job.duplicateItems} duplicados
            </span>
            {!job.done && (
              <span className="flex items-center gap-1 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> processando…
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <tbody>
                {job.items.map((it) => (
                  <tr key={it.row_number} className="border-t border-gray-100">
                    <td className="px-2 py-1 text-gray-700 whitespace-nowrap">
                      {it.name}
                    </td>
                    <td className="px-2 py-1 text-gray-500">{it.email}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {STATUS_LABEL[it.status] ?? it.status}
                    </td>
                    <td className="px-2 py-1 text-xs text-red-500">
                      {it.error_message ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {job.done && (
            <div className="flex justify-end mt-4">
              <Button type="button" onClick={onClose}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
