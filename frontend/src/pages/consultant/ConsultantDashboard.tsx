import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, FilePen, Plus, TrendingUp, Users } from "lucide-react";
import {
  getAllConsultantProcesses,
  getClients,
  type Client,
  type ConsultantProcess,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge, PROCESS_STATUS_META } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";
import InviteClientForm from "./InviteClientForm";
import BatchInviteClients from "./BatchInviteClients";

const TERMINAL_STATUSES = ["COMPLETED", "REJECTED"];

function daysSince(dateString: string): number {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<ConsultantProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [clientsData, processesData] = await Promise.all([
        getClients(),
        getAllConsultantProcesses(),
      ]);
      setClients(clientsData);
      setProcesses(processesData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeProcesses = useMemo(
    () => processes.filter((p) => !TERMINAL_STATUSES.includes(p.status)),
    [processes],
  );
  const completedCount = useMemo(
    () => processes.filter((p) => p.status === "COMPLETED").length,
    [processes],
  );
  const rejectedCount = useMemo(
    () => processes.filter((p) => p.status === "REJECTED").length,
    [processes],
  );
  const conversionRate = useMemo(() => {
    const finalized = completedCount + rejectedCount;
    return finalized > 0 ? Math.round((completedCount / finalized) * 100) : 0;
  }, [completedCount, rejectedCount]);

  const pendingProcesses = useMemo(
    () =>
      [...activeProcesses]
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .slice(0, 5),
    [activeProcesses],
  );

  const statusDistribution = useMemo(
    () =>
      PROCESS_STATUS_META.map((meta) => ({
        ...meta,
        count: processes.filter((p) => p.status === meta.value).length,
      })),
    [processes],
  );

  const recentClients = useMemo(
    () =>
      [...clients]
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 5),
    [clients],
  );

  const handleQuickActionSuccess = () => {
    setIsInviteModalOpen(false);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-border-soft border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <Button type="button" variant="light" onClick={() => setIsBatchModalOpen(true)}>
              Convite em lote
            </Button>
            <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
              <Plus size={16} />
              Convidar cliente
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <Users size={14} />
            Clientes
          </div>
          <p className="text-2xl font-bold text-ink">{clients.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <FilePen size={14} />
            Processos ativos
          </div>
          <p className="text-2xl font-bold text-ink">{activeProcesses.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <CheckCircle2 size={14} />
            Concluídos
          </div>
          <p className="text-2xl font-bold text-ink">{completedCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <TrendingUp size={14} />
            Taxa de conversão
          </div>
          <p className="text-2xl font-bold text-ink">{conversionRate}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 font-semibold text-ink">Processos vigentes</h2>
            <button
              type="button"
              onClick={() => navigate("/consultant/processes")}
              className="text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Ver todos
            </button>
          </div>
          {pendingProcesses.length === 0 ? (
            <EmptyState
              icon={FilePen}
              title="Nenhum processo em andamento"
              description="Processos ativos dos seus clientes aparecem aqui."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingProcesses.map((proc) => (
                <div
                  key={proc.id}
                  onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                  className="flex items-center justify-between gap-3 bg-surface rounded-lg px-4 py-3 border border-border-soft hover:border-border cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={proc.status} />
                    <span className="text-sm text-muted truncate">
                      {proc.client ? `${proc.client.name} ${proc.client.surname}` : "—"}
                      {proc.specialist
                        ? ` • ${proc.specialist.name} ${proc.specialist.surname}`
                        : ""}
                    </span>
                  </div>
                  <span className="text-xs text-subtle whitespace-nowrap">
                    {daysSince(proc.updated_at)}d sem atualização
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-h2 font-semibold text-ink mb-4">Distribuição por status</h2>
            {processes.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Sem dados ainda"
                description="A distribuição por status aparece aqui quando houver processos."
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusDistribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 12, fill: "#6b6b6b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "#e9e9e9" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.value} fill={entry.hex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-semibold text-ink">Clientes recentes</h2>
              <button
                type="button"
                onClick={() => navigate("/consultant/clients")}
                className="text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Ver todos
              </button>
            </div>
            {recentClients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente ainda"
                description='Clique em "Convidar cliente" para começar.'
              />
            ) : (
              <div className="flex flex-col gap-2">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-3 px-1 py-2 border-b border-border-soft last:border-b-0"
                  >
                    <span className="text-sm font-medium text-ink truncate">
                      {client.name} {client.surname}
                    </span>
                    <span className="text-xs text-subtle whitespace-nowrap">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent open={isInviteModalOpen} title="Convidar cliente" hideTitle>
          <InviteClientForm onSuccess={handleQuickActionSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent open={isBatchModalOpen} title="Convite de clientes em lote" hideTitle>
          <BatchInviteClients
            onClose={() => {
              setIsBatchModalOpen(false);
              fetchData();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
