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
import { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import {
  getDashboardStats,
  type DashboardStats,
} from "../../services/dashboard.service";
import { AppContext } from "../../contexts/AppContext";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";

export default function DashboardPage() {
  const { setSearchTerm } = useContext(AppContext);

  // Estado para armazenar as estatísticas reais
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Limpar barra de pesquisa ao entrar no Dashboard
  useEffect(() => {
    setSearchTerm("");
  }, [setSearchTerm]);

  // Buscar estatísticas ao carregar a página
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

  // Paleta própria do gráfico (identidade visual por consultor) — não é paleta de status, fica como está
  const COLORS = ["#3B82F6", "#1E40AF", "#1E3A8A", "#0C2340", "#051E3E"];

  return (
    <div className="w-full">
      <PageHeader title="Seja bem vindo de volta, Administrador!" />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Card 1: Processos Ativos - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">Processos Ativos</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {stats?.activeProcesses || 0}
              </p>
              <p className="text-sm text-muted">Processos em andamento</p>
            </>
          )}
        </Card>

        {/* Card 2: Taxa de Conversão - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">Taxa de Conversão</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {stats?.conversionRate || 0}%
              </p>
              <p className="text-sm text-muted">Meta 80%</p>
            </>
          )}
        </Card>

        {/* Card 3: Escritórios Ativos - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">
            Escritórios Ativos
          </p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {stats?.activeCompanies || 0}
              </p>
              <p className="text-sm text-muted">Empresas parceiras</p>
            </>
          )}
        </Card>

        {/* Card 4: Especialistas Ativos - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">
            Especialistas Ativos
          </p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {specialistsCount}
              </p>
              <p className="text-sm text-muted">
                Carros, Lanchas, Helicópteros
              </p>
            </>
          )}
        </Card>

        {/* Card 5: Clientes Cadastrados - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">
            Clientes Cadastrados
          </p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {stats?.totalClients || 0}
              </p>
              <p className="text-sm text-muted">Total na plataforma</p>
            </>
          )}
        </Card>

        {/* Card 6: Produtos Cadastrados - DADOS REAIS */}
        <Card>
          <p className="text-ink-soft font-semibold mb-2">
            Produtos Cadastrados
          </p>
          {isLoading ? (
            <p className="text-2xl font-bold text-ink mb-2">Carregando...</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-ink mb-2">
                {stats?.totalProducts || 0}
              </p>
              <p className="text-sm text-muted">
                {stats?.productsByType.cars ?? 0} carros ·{" "}
                {stats?.productsByType.boats ?? 0} embarcações ·{" "}
                {stats?.productsByType.aircrafts ?? 0} aeronaves
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <Card className="md:col-span-2">
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
              <Line type="monotone" dataKey="naoVendidos" stroke="#EF4444" />
              <Line type="monotone" dataKey="vendidos" stroke="#22C55E" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Gráfico de Desempenho por Consultor */}
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

              {/* Legenda do gráfico */}
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
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <ActionCard to="/admin/companies" label="Gerenciar escritórios" />
        <ActionCard to="/admin/specialists" label="Gerenciar especialistas" />
        <ActionCard to="/admin/settings" label="Configurações" />
      </div>
    </div>
  );
}

function ActionCard({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="block bg-action hover:bg-ink text-white font-medium py-4 px-6 rounded-lg shadow-ds-card text-center"
    >
      {label}
    </Link>
  );
}
