import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import {
  officeService,
  type OfficeConsultant,
  type InviteJobDetail,
} from "../../services/office";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import { EmptyState } from "../../components/patterns/EmptyState";

export default function OfficeConsultantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "batch" ? "batch" : "list";

  return (
    <div className="p-8">
      <div className="flex items-center gap-6 border-b border-border mb-6">
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
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink-soft"
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
  const [consultantToDeactivate, setConsultantToDeactivate] = useState<OfficeConsultant | null>(null);

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

  const confirmDeactivate = async () => {
    if (!consultantToDeactivate) return;
    const c = consultantToDeactivate;
    setConsultantToDeactivate(null);
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
      <PageHeader
        title="Consultores"
        actions={
          <Button onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? "Fechar" : "Convidar consultor"}
          </Button>
        }
      />

      {showInvite && (
        <form onSubmit={submitInvite} className="bg-surface p-4 rounded-lg shadow mb-6 flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            required
            className="flex-1 px-3 py-2 border border-border rounded-md"
          />
          <Button type="submit">Enviar convite</Button>
        </form>
      )}
      {inviteMsg && (
        <p className={`mb-4 text-sm ${inviteMsg.ok ? "text-status-ok" : "text-status-bad"}`}>
          {inviteMsg.text}
        </p>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="flex-1 px-3 py-2 border border-border rounded-md"
        />
        <Button onClick={load}>Buscar</Button>
      </div>

      {loading && <p className="text-muted">Carregando...</p>}
      {error && <p className="text-status-bad">{error}</p>}
      {!loading && consultants.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum consultor ainda."
          description='Use "Convidar consultor" acima para começar.'
        />
      )}

      {consultants.length > 0 && (
        <div className="bg-surface rounded-lg shadow overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-border-soft border-b border-border">
              <tr>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Clientes</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Comissão</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted uppercase px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {consultants.map((c) => (
                <tr key={c.id} className="border-b border-border-soft">
                  <td className="px-4 py-3 text-sm">{c.name} {c.surname}</td>
                  <td className="px-4 py-3 text-sm text-muted">{c.email}</td>
                  <td className="px-4 py-3 text-sm">{c.clients_count}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.commission_rate != null ? `${c.commission_rate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.is_active ? (
                      <span className="text-status-ok">Ativo</span>
                    ) : (
                      <span className="text-muted">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.is_active ? (
                      <button
                        disabled={busyAction === c.id}
                        onClick={() => setConsultantToDeactivate(c)}
                        className="text-status-bad hover:underline text-sm"
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        disabled={busyAction === c.id}
                        onClick={() => reactivate(c)}
                        className="text-status-ok hover:underline text-sm"
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

      <Dialog open={!!consultantToDeactivate} onOpenChange={(open) => !open && setConsultantToDeactivate(null)}>
        <DialogContent open={!!consultantToDeactivate} title="Confirmar Desativação" hideTitle>
          <div className="text-center">
            <h2 className="text-h2 font-semibold text-ink mb-4">Confirmar Desativação</h2>
            <p className="text-text-secondary mb-8">
              Desativar{" "}
              <span className="font-bold">
                {consultantToDeactivate?.name} {consultantToDeactivate?.surname}
              </span>
              ? Clientes serão desvinculados.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="light" onClick={() => setConsultantToDeactivate(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmDeactivate}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      <p className="text-muted mb-6">
        Envie um CSV com colunas <strong>name</strong> e <strong>email</strong>. Cada linha gera um
        convite individual ao consultor.
      </p>

      <Card className="mb-6">
        <form onSubmit={submit}>
          <label className="block text-sm font-medium text-ink-soft mb-2">Arquivo CSV (máx. 5MB)</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft border border-border rounded-md p-2"
          />
          <div className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Iniciar convite em lote"}
            </Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-status-bad mb-4">{error}</p>}

      {job && (
        <Card>
          <h2 className="text-lg font-bold mb-2">Job: {job.jobId.slice(0, 8)}…</h2>
          <p className="text-sm text-muted">
            Status: <strong>{job.status}</strong> — {job.processedItems}/{job.totalItems} processados
            ({job.successItems} ok, {job.failedItems} falhas, {job.duplicateItems} duplicatas)
          </p>
          {job.errorMessage && <p className="text-status-bad text-sm mt-2">{job.errorMessage}</p>}

          <div className="mt-4 max-h-96 overflow-auto border border-border rounded">
            <table className="w-full text-sm">
              <thead className="bg-border-soft sticky top-0">
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
                  <tr key={it.row_number} className="border-t border-border-soft">
                    <td className="px-3 py-2">{it.row_number}</td>
                    <td className="px-3 py-2">{it.name}</td>
                    <td className="px-3 py-2 text-muted">{it.email}</td>
                    <td className="px-3 py-2">
                      <StatusBadge s={it.status} />
                    </td>
                    <td className="px-3 py-2 text-status-bad">{it.error_message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    SENT: "bg-status-ok-wash text-status-ok",
    ACCEPTED: "bg-status-ok-wash text-status-ok",
    PENDING: "bg-border-soft text-ink-soft",
    PROCESSING: "bg-status-sched-wash text-status-sched",
    DUPLICATE: "bg-status-neg-wash text-status-neg",
    FAILED: "bg-status-bad-wash text-status-bad",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s] || "bg-border-soft text-ink-soft"}`}>{s}</span>
  );
}
