import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Loader, AlertCircle, ExternalLink } from "lucide-react";
import { getAdvisedClients, type AdvisedClient } from "../../services/advisor.service";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  CONTRACT: "Contrato",
  COMPLETED: "Concluído",
  REJECTED: "Recusado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-amber-100 text-amber-700",
  CONTRACT: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
};

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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel do Assessor</h1>
          <p className="text-sm text-gray-500">Clientes que você assessora</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {!loading && !error && clients.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum cliente ainda</p>
          <p className="text-sm mt-1">
            Você será listado aqui quando um cliente aceitar seu convite de assessor.
          </p>
        </div>
      )}

      {!loading && clients.length > 0 && (
        <div className="space-y-4">
          {clients.map((item) => (
            <div
              key={item.relation_id}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {item.customer.name} {item.customer.surname}
                  </h2>
                  <p className="text-sm text-gray-500">{item.customer.email}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  desde {new Date(item.accepted_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {item.customer.processesAsClient.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum processo registrado.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Processos recentes
                  </p>
                  {item.customer.processesAsClient.map((proc) => (
                    <div
                      key={proc.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[proc.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {STATUS_LABELS[proc.status] ?? proc.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {proc.product_type ?? "Produto"} &middot;{" "}
                          {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/processes/${proc.id}/negotiation`)}
                        className="text-slate-600 hover:text-slate-900"
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
