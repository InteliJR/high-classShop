import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  officeService,
  type OfficeConsultant,
  type InviteJobDetail,
} from "../../services/office";
import Button from "../../components/ui/button";

export default function OfficeConsultantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "batch" ? "batch" : "list";

  return (
    <div className="p-8">
      <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
        <TabButton
          active={tab === "list"}
          onClick={() => setSearchParams({})}
        >
          Consultores
        </TabButton>
        <TabButton
          active={tab === "batch"}
          onClick={() => setSearchParams({ tab: "batch" })}
        >
          Convite em lote
        </TabButton>
      </div>

      {tab === "list" ? <ConsultantsList /> : <BatchInvite />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
        active
          ? "border-slate-700 text-slate-900"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function ConsultantsList() {
  const [consultants, setConsultants] = useState<OfficeConsultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    officeService
      .listConsultants({ q: q || undefined })
      .then(setConsultants)
      .catch((e) =>
        setError((e as { friendlyMessage?: string }).friendlyMessage || "Erro ao carregar consultores"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg(null);
    try {
      await officeService.inviteConsultant(inviteEmail.trim().toLowerCase());
      setInviteMsg({ ok: true, text: "Convite enviado!" });
      setInviteEmail("");
    } catch (err) {
      setInviteMsg({
        ok: false,
        text: (err as { friendlyMessage?: string }).friendlyMessage || "Erro ao enviar convite",
      });
    }
  };

  const deactivate = async (c: OfficeConsultant) => {
    if (!confirm(`Desativar ${c.name} ${c.surname}? Clientes serão desvinculados.`)) return;
    setBusyAction(c.id);
    try {
      await officeService.deactivateConsultant(c.id);
      load();
    } catch (err) {
      alert((err as { friendlyMessage?: string }).friendlyMessage || "Erro ao desativar");
    } finally {
      setBusyAction(null);
    }
  };

  const reactivate = async (c: OfficeConsultant) => {
    setBusyAction(c.id);
    try {
      await officeService.reactivateConsultant(c.id);
      load();
    } catch (err) {
      alert((err as { friendlyMessage?: string }).friendlyMessage || "Erro ao reativar");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Consultores</h1>
        <Button onClick={() => setShowInvite((v) => !v)}>
          {showInvite ? "Fechar" : "Convidar consultor"}
        </Button>
      </div>

      {showInvite && (
        <form onSubmit={submitInvite} className="bg-white p-4 rounded-lg shadow mb-6 flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <Button type="submit">Enviar convite</Button>
        </form>
      )}
      {inviteMsg && (
        <p className={`mb-4 text-sm ${inviteMsg.ok ? "text-green-600" : "text-red-600"}`}>
          {inviteMsg.text}
        </p>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <Button onClick={load}>Buscar</Button>
      </div>

      {loading && <p className="text-gray-500">Carregando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && consultants.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          Nenhum consultor ainda. Use "Convidar consultor" acima para começar.
        </div>
      )}

      {consultants.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Clientes</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Comissão</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {consultants.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{c.name} {c.surname}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-sm">{c.clients_count}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.commission_rate != null ? `${c.commission_rate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.is_active ? (
                      <span className="text-green-600">Ativo</span>
                    ) : (
                      <span className="text-gray-500">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.is_active ? (
                      <button
                        disabled={busyAction === c.id}
                        onClick={() => deactivate(c)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        disabled={busyAction === c.id}
                        onClick={() => reactivate(c)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BatchInvite() {
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
    <div className="max-w-4xl">
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
