import { useEffect, useState } from "react";
import { officeService, type OfficeConsultant } from "../../services/office";
import Button from "../../components/ui/button";

export default function OfficeConsultantsPage() {
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
    <div className="p-8">
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
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
                  <td className="px-4 py-3 text-sm">{c.commission_rate ?? "—"}%</td>
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
