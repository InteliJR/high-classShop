import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useState, useContext, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Building2,
  UserCog,
  Users,
  Package,
  Percent,
  Database,
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  getDashboardStats,
  type DashboardStats,
} from "../../services/dashboard.service";
import { AppContext } from "../../contexts/AppContext";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type RecentSale = DashboardStats["commissionSummary"]["recentSales"][number];

export default function DashboardPage() {
  const { setSearchTerm } = useContext(AppContext);
  const shouldReduceMotion = useReducedMotion();
  const cardDuration = shouldReduceMotion ? 0 : 0.2;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSearchTerm("");
  }, [setSearchTerm]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const specialistsCount = stats?.specialistsCount ?? 0;
  const salesByMonth = stats?.salesByMonth ?? [];
  const consultantsPerformance = stats?.consultantsPerformance ?? [];
  const commissionSummary = stats?.commissionSummary ?? {
    totalPaid: 0,
    thisMonth: 0,
    avgTicket: 0,
    recentSales: [] as RecentSale[],
  };
  const databaseCounts = stats?.databaseCounts ?? [];

  // Paleta própria do gráfico (identidade visual por consultor) — não é paleta de status, fica como está
  const COLORS = ["#3B82F6", "#1E40AF", "#1E3A8A", "#0C2340", "#051E3E"];

  const kpis: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    sub: string;
  }[] = [
    {
      icon: Activity,
      label: "Processos Ativos",
      value: stats?.activeProcesses ?? 0,
      sub: "Processos em andamento",
    },
    {
      icon: Building2,
      label: "Escritórios Ativos",
      value: stats?.activeCompanies ?? 0,
      sub: "Empresas parceiras",
    },
    {
      icon: UserCog,
      label: "Especialistas Ativos",
      value: specialistsCount,
      sub: "Carros, Lanchas, Helicópteros",
    },
    {
      icon: Users,
      label: "Clientes Cadastrados",
      value: stats?.totalClients ?? 0,
      sub: "Total na plataforma",
    },
    {
      icon: Package,
      label: "Produtos Cadastrados",
      value: stats?.totalProducts ?? 0,
      sub: `${stats?.productsByType.cars ?? 0} carros · ${
        stats?.productsByType.boats ?? 0
      } embarcações · ${stats?.productsByType.aircrafts ?? 0} aeronaves`,
    },
  ];

  const quickActions: {
    to: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
  }[] = [
    { to: "/admin/companies", icon: Building2, label: "Gerenciar escritórios" },
    {
      to: "/admin/specialists",
      icon: UserCog,
      label: "Gerenciar especialistas",
    },
    { to: "/admin/settings", icon: Settings, label: "Configurações" },
  ];

  return (
    <div className="w-full">
      <PageHeader title="Seja bem vindo de volta, Administrador!" />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: cardDuration, delay: index * 0.03 }}
          >
            <Card>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-border-soft flex items-center justify-center shrink-0">
                  <kpi.icon className="w-5 h-5 text-ink-soft" />
                </div>
                <div className="min-w-0">
                  <p className="text-ink-soft font-semibold mb-1">
                    {kpi.label}
                  </p>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-ink">
                      Carregando...
                    </p>
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-ink mb-1">
                        {kpi.value}
                      </p>
                      <p className="text-sm text-muted">{kpi.sub}</p>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Comissão por processo + Base de dados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.15 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-ink-soft" />
                <h2 className="text-lg font-semibold text-ink">
                  Comissão por processo
                </h2>
              </div>
              <Link
                to="/admin/commissions?tab=sales"
                className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
              >
                ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted mb-1">Total pago</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Este mês</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.thisMonth)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Ticket médio</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.avgTicket)}
                </p>
              </div>
            </div>

            {commissionSummary.recentSales.length === 0 ? (
              <p className="text-sm text-subtle">
                Nenhuma venda fechada ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {commissionSummary.recentSales.map((sale) => (
                  <div
                    key={sale.processId}
                    className="flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {sale.productLabel} · {sale.clientName}
                      </p>
                      <CommissionSplitBar sale={sale} />
                    </div>
                    <p className="text-sm font-semibold text-ink shrink-0">
                      {brl(sale.totalCommission)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.18 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-ink-soft" />
                <h2 className="text-lg font-semibold text-ink">
                  Base de dados
                </h2>
              </div>
              <Link
                to="/admin/database"
                className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
              >
                ver tudo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {databaseCounts.map((entity) => (
                <Link
                  key={entity.key}
                  to="/admin/database"
                  className="border border-border rounded-lg p-3 transition-shadow hover:shadow-ds-floating"
                >
                  <p className="text-sm text-muted mb-1">{entity.label}</p>
                  <p className="text-2xl font-bold text-ink">
                    {entity.count}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.21 }}
        >
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Vendas</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-muted">Não vendidos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-muted">Vendidos</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="naoVendidos"
                  stroke="#EF4444"
                />
                <Line type="monotone" dataKey="vendidos" stroke="#22C55E" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.24 }}
        >
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">
              Desempenho de Vendas por Consultor
            </h2>
            {consultantsPerformance.length === 0 ? (
              <p className="text-sm text-muted">
                Sem dados suficientes para exibir o desempenho por consultor.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={consultantsPerformance}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {consultantsPerformance.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {consultantsPerformance.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        ></div>
                        <span className="text-ink-soft">{item.name}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-ink font-semibold">
                          {item.value} vendas
                        </span>
                        <span className="text-status-ok font-semibold">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: cardDuration, delay: 0.27 + index * 0.03 }}
          >
            <ActionCard {...action} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 transition-shadow hover:shadow-ds-floating">
        <div className="w-10 h-10 rounded-lg bg-border-soft flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-ink-soft" />
        </div>
        <span className="font-medium text-ink">{label}</span>
      </Card>
    </Link>
  );
}

function CommissionSplitBar({ sale }: { sale: RecentSale }) {
  const total = sale.totalCommission > 0 ? sale.totalCommission : 1;
  const specialistPct = (sale.specialistValue / total) * 100;
  const officePct = (sale.officeValue / total) * 100;
  const platformPct = (sale.platformValue / total) * 100;

  return (
    <div className="flex h-1.5 w-full max-w-xs rounded-full overflow-hidden bg-border-soft mt-1">
      <div className="bg-emerald-500" style={{ width: `${specialistPct}%` }} />
      <div className="bg-sky-500" style={{ width: `${officePct}%` }} />
      <div className="bg-violet-500" style={{ width: `${platformPct}%` }} />
    </div>
  );
}
