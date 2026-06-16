import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  User,
  UserCog,
  X,
} from "lucide-react";
import {
  getProcessProposals,
  type NegotiationMeta,
  type NegotiationProcessInfo,
  type NegotiationProposal,
} from "../../services/proposals.service";
import {
  getProcessById,
  type Process,
} from "../../services/processes.service";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  PROCESSING_CONTRACT: "Contrato",
  DOCUMENTATION: "Documentação",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-yellow-100 text-yellow-700",
  PROCESSING_CONTRACT: "bg-orange-100 text-orange-700",
  DOCUMENTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProposalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
          <Loader2 size={12} className="animate-spin" />
          Aguardando resposta
        </span>
      );
    case "ACCEPTED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
          <Check size={12} />
          Aceita
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
          <X size={12} />
          Rejeitada
        </span>
      );
    case "COUNTERED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
          <RefreshCw size={12} />
          Contraproposta enviada
        </span>
      );
    default:
      return null;
  }
}

export default function ConsultantProcessDetailPage() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();

  const [process, setProcess] = useState<Process | null>(null);
  const [proposals, setProposals] = useState<NegotiationProposal[]>([]);
  const [processInfo, setProcessInfo] =
    useState<NegotiationProcessInfo | null>(null);
  const [meta, setMeta] = useState<NegotiationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!processId) return;

    try {
      setIsLoading(true);
      setError(null);

      const processData = await getProcessById(processId);
      setProcess(processData);

      const hasProduct = !!processData.product_type && !!processData.product_id;
      if (hasProduct) {
        try {
          const response = await getProcessProposals(processId);
          if (response.success) {
            setProposals(response.data);
            setProcessInfo(response.process);
            setMeta(response.meta);
          }
        } catch (err) {
          console.warn(
            "[ConsultantProcessDetailPage] Falha ao carregar propostas",
            err,
          );
        }
      } else {
        setProposals([]);
        setProcessInfo(null);
        setMeta(null);
      }
    } catch (err) {
      console.error("[ConsultantProcessDetailPage] Erro:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao carregar processo",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [proposals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="animate-spin mr-2" size={20} />
        Carregando processo...
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="text-red-500 mb-3" size={40} />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Não foi possível carregar o processo
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {error ?? "Processo não encontrado."}
        </p>
        <button
          onClick={() => navigate("/consultant/processes")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
          Voltar para processos
        </button>
      </div>
    );
  }

  const productLabel = process.product_type
    ? PRODUCT_LABELS[process.product_type] ?? process.product_type
    : "Consultoria";
  const statusLabel = STATUS_LABELS[process.status] ?? process.status;
  const statusColor =
    STATUS_COLORS[process.status] ?? "bg-gray-100 text-gray-600";

  const acceptedProposal = proposals.find((p) => p.status === "ACCEPTED");

  return (
    <div className="text-text-main w-full">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/consultant/processes")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="h1-style">Detalhes do processo</h1>
            <p className="text-sm text-gray-500 mt-1">
              Visualização somente leitura. A negociação é conduzida entre
              cliente e especialista.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <User size={14} />
            Cliente
          </div>
          <p className="text-sm font-medium text-gray-900">
            {process.client?.name ?? "—"}
          </p>
          {process.client?.email && (
            <p className="text-xs text-gray-500 mt-1">{process.client.email}</p>
          )}
        </div>

        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <UserCog size={14} />
            Especialista
          </div>
          <p className="text-sm font-medium text-gray-900">
            {process.specialist?.name ?? "—"}
          </p>
          {process.specialist?.especialidade && (
            <p className="text-xs text-gray-500 mt-1">
              {process.specialist.especialidade}
            </p>
          )}
        </div>

        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Package size={14} />
            Produto
          </div>
          <p className="text-sm font-medium text-gray-900">{productLabel}</p>
          {process.product && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {[process.product.marca, process.product.modelo]
                .filter(Boolean)
                .join(" ")}
              {process.product.ano ? ` • ${process.product.ano}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg shadow bg-white mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </span>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={14} className="text-gray-400" />
          Criado em {formatDate(process.created_at)}
        </div>
        {process.appointment_datetime && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            Reunião: {formatDate(process.appointment_datetime)}
          </div>
        )}
        {process.rejection_reason && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} />
            Motivo da rejeição: {process.rejection_reason}
          </div>
        )}
      </div>

      {processInfo && (
        <div className="p-4 rounded-lg shadow bg-white mb-6 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-green-600" />
            <span className="text-gray-500">Valor do produto:</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(processInfo.product_value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-gray-500">Valor mínimo:</span>
            <span className="font-semibold text-orange-600">
              {formatCurrency(processInfo.minimum_value)}
            </span>
          </div>
          {acceptedProposal && (
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="text-gray-500">Valor aceito:</span>
              <span className="font-semibold text-green-700">
                {formatCurrency(acceptedProposal.proposed_value)}
              </span>
            </div>
          )}
          {meta && (
            <div className="ml-auto text-xs text-gray-400">
              {meta.total} {meta.total === 1 ? "proposta" : "propostas"}
            </div>
          )}
        </div>
      )}

      <div className="p-6 rounded-lg shadow bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="h2-style">Histórico de propostas</h2>
        </div>

        {!process.product_type || !process.product_id ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            A negociação ainda não foi iniciada. O especialista precisa
            associar um produto ao processo.
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare size={40} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              Nenhuma proposta enviada até o momento.
            </p>
          </div>
        ) : (
          <div
            ref={timelineRef}
            className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1"
          >
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {proposal.proposed_by.name} {proposal.proposed_by.surname}
                    <span className="text-gray-400">
                      {" "}
                      → {proposal.proposed_to.name}{" "}
                      {proposal.proposed_to.surname}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(proposal.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-green-600" />
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(proposal.proposed_value)}
                  </span>
                </div>
                {proposal.message && (
                  <p className="text-sm text-gray-600 mb-2">
                    {proposal.message}
                  </p>
                )}
                <ProposalStatusBadge status={proposal.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
