import { useEffect, useRef, useState } from "react";
import { officeService, type InviteJobDetail } from "../../services/office";
import Button from "../../components/ui/button";

export default function OfficeBatchInvitePage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<InviteJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPoll(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    setSubmitting(true);
    try {
      const created = (await officeService.createInviteJob(file)) as { jobId: string };
      // Poll
      const poll = async () => {
        try {
          const detail = await officeService.getInviteJob(created.jobId);
          setJob(detail);
          if (detail.done) stopPoll();
        } catch (e) {
          setError((e as { friendlyMessage?: string }).friendlyMessage || "Erro ao consultar job");
          stopPoll();
        }
      };
      await poll();
      pollRef.current = window.setInterval(poll, 2000);
    } catch (err) {
      const e = err as { friendlyMessage?: string; response?: { data?: { message?: string; errors?: string[] } } };
      setError(e.friendlyMessage || e.response?.data?.message || "Falha ao enviar planilha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Convite em lote</h1>
      <p className="text-gray-600 mb-6">
        Envie um CSV com colunas <strong>name</strong> e <strong>email</strong>. Cada linha gera um
        convite individual ao consultor.
      </p>

      <form onSubmit={submit} className="bg-white p-6 rounded-lg shadow mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo CSV (máx. 5MB)</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 border border-gray-300 rounded-md p-2"
        />
        <div className="mt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Iniciar convite em lote"}
          </Button>
        </div>
      </form>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {job && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-2">Job: {job.jobId.slice(0, 8)}…</h2>
          <p className="text-sm text-gray-600">
            Status: <strong>{job.status}</strong> — {job.processedItems}/{job.totalItems} processados
            ({job.successItems} ok, {job.failedItems} falhas, {job.duplicateItems} duplicatas)
          </p>
          {job.errorMessage && <p className="text-red-600 text-sm mt-2">{job.errorMessage}</p>}

          <div className="mt-4 max-h-96 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Linha</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">E-mail</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Erro</th>
                </tr>
              </thead>
              <tbody>
                {job.items.map((it) => (
                  <tr key={it.row_number} className="border-t">
                    <td className="px-3 py-2">{it.row_number}</td>
                    <td className="px-3 py-2">{it.name}</td>
                    <td className="px-3 py-2 text-gray-600">{it.email}</td>
                    <td className="px-3 py-2">
                      <StatusBadge s={it.status} />
                    </td>
                    <td className="px-3 py-2 text-red-600">{it.error_message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    SENT: "bg-green-100 text-green-700",
    ACCEPTED: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-gray-100 text-gray-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    DUPLICATE: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s] || "bg-gray-100"}`}>{s}</span>
  );
}
