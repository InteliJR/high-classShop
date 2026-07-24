import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { officeService, type OfficeClient } from "../../services/office";
import { PageHeader } from "../../components/patterns/PageHeader";
import { EmptyState } from "../../components/patterns/EmptyState";

export default function OfficeClientsPage() {
  const [clients, setClients] = useState<OfficeClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    officeService
      .listClients({ q: q || undefined })
      .then(setClients)
      .catch((e) =>
        setError((e as { friendlyMessage?: string }).friendlyMessage || "Erro ao carregar clientes"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8">
      <PageHeader title="Clientes do escritório" />

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Buscar por nome ou email..."
          className="flex-1 px-3 py-2 border border-border rounded-md"
        />
      </div>

      {loading && <p className="text-muted">Carregando...</p>}
      {error && <p className="text-status-bad">{error}</p>}
      {!loading && clients.length === 0 && (
        <EmptyState icon={Users} title="Nenhum cliente ainda." />
      )}

      {clients.length > 0 && (
        <div className="bg-surface rounded-lg shadow overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-border-soft border-b border-border">
              <tr>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Consultor</th>
                <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border-soft">
                  <td className="px-4 py-3 text-sm">{c.name} {c.surname}</td>
                  <td className="px-4 py-3 text-sm text-muted">{c.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.consultant ? `${c.consultant.name} ${c.consultant.surname}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
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
