import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Loader, AlertCircle, ExternalLink } from "lucide-react";
import { getAdvisedClients, type AdvisedClient } from "../../services/advisor.service";
import { StatusBadge } from "../../components/patterns/StatusBadge";
import { Alert } from "../../components/ui/alert";
import { EmptyState } from "../../components/patterns/EmptyState";
import { BackButton } from "../../components/patterns/BackButton";

export default function AdvisorDashboardPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<AdvisedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdvisedClients()
      .then(setClients)
      .catch(() => setError("Não foi possível carregar os clientes."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <BackButton className="mb-2" />
        <h1 className="text-2xl font-bold text-ink">Painel do Assessor</h1>
        <p className="text-sm text-muted">Clientes que você assessora</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted py-12 justify-center">
          <Loader className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      )}

      {error && (
        <Alert variant="danger">
          <AlertCircle size={18} />
          {error}
        </Alert>
      )}

      {!loading && !error && clients.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Você será listado aqui quando um cliente aceitar seu convite de assessor."
        />
      )}

      {!loading && clients.length > 0 && (
        <div className="space-y-4">
          {clients.map((item) => (
            <div
              key={item.relation_id}
              className="bg-surface rounded-xl border border-border p-6 shadow-ds-card"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    {item.customer.name} {item.customer.surname}
                  </h2>
                  <p className="text-sm text-muted">{item.customer.email}</p>
                </div>
                <span className="text-xs text-subtle whitespace-nowrap">
                  desde {new Date(item.accepted_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {item.customer.processesAsClient.length === 0 ? (
                <p className="text-sm text-subtle">Nenhum processo registrado.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-2">
                    Processos recentes
                  </p>
                  {item.customer.processesAsClient.map((proc) => (
                    <div
                      key={proc.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 bg-bg rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={proc.status} />
                        <span className="text-xs text-muted">
                          {proc.product_type ?? "Produto"} &middot;{" "}
                          {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/processes/${proc.id}/negotiation`)}
                        className="text-ink-soft hover:text-ink"
                        title="Ver processo"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
