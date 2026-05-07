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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import {
  getSpecialistDashboardStats,
  type SpecialistDashboardStats,
} from "../../services/dashboard.service";

// Gráficos MOCKADOS (mantidos fixos, independentes do backend)
const MOCK_SALES_BY_MONTH = [
  { month: "Jan", vendidos: 4, naoVendidos: 2 },
  { month: "Fev", vendidos: 3, naoVendidos: 1 },
  { month: "Mar", vendidos: 2, naoVendidos: 3 },
  { month: "Abr", vendidos: 5, naoVendidos: 2 },
  { month: "Mai", vendidos: 1, naoVendidos: 4 },
  { month: "Jun", vendidos: 3, naoVendidos: 2 },
  { month: "Jul", vendidos: 4, naoVendidos: 1 },
  { month: "Ago", vendidos: 2, naoVendidos: 2 },
  { month: "Set", vendidos: 3, naoVendidos: 3 },
  { month: "Out", vendidos: 4, naoVendidos: 2 },
  { month: "Nov", vendidos: 5, naoVendidos: 1 },
  { month: "Dez", vendidos: 6, naoVendidos: 2 },
];

const MOCK_PROCESSES_BY_STATUS = [
  { name: "Concluído", value: 4, color: "#22C55E" },
  { name: "Negociação", value: 3, color: "#3B82F6" },
  { name: "Agendamento", value: 2, color: "#F59E0B" },
  { name: "Documentação", value: 1, color: "#A855F7" },
];

export default function SpecialistDashboard() {
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState<SpecialistDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Se o usuário não tem especialidade definida, redireciona para o catálogo
    if (!user?.speciality) {
      navigate("/catalog/cars");
      return;
    }

    async function fetchStats() {
      if (!user?.id) return;

      try {
        const data = await getSpecialistDashboardStats(user.id);
        setStats(data);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [user, navigate]);

  if (!user?.speciality) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Olá, {user.name}!
        </h1>
        <p className="text-gray-600">
          Acompanhe o desempenho dos seus produtos e processos de venda
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Card 1: Produtos Cadastrados */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">
            Produtos Cadastrados
          </p>
          {isLoading ? (
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Carregando...
            </p>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats?.productsListed || 0}
              </p>
              <p className="text-sm text-gray-600">Total de produtos</p>
            </>
          )}
        </div>

        {/* Card 2: Processos Ativos */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Processos Ativos</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Carregando...
            </p>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats?.activeProcesses || 0}
              </p>
              <p className="text-sm text-gray-600">Em andamento</p>
            </>
          )}
        </div>

        {/* Card 3: Vendas Concluídas */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Vendas Concluídas</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Carregando...
            </p>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats?.completedSales || 0}
              </p>
              <p className="text-sm text-gray-600">Total de vendas</p>
            </>
          )}
        </div>

        {/* Card 4: Taxa de Conversão */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Taxa de Conversão</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Carregando...
            </p>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats?.conversionRate || 0}%
              </p>
              <p className="text-sm text-gray-600">Meta 80%</p>
            </>
          )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gráfico de Vendas por Mês */}
        <div className="md:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Vendas por Mês
          </h2>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Não vendidos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Vendidos</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={MOCK_SALES_BY_MONTH}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="naoVendidos"
                stroke="#EF4444"
                name="Não vendidos"
              />
              <Line
                type="monotone"
                dataKey="vendidos"
                stroke="#22C55E"
                name="Vendidos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Pizza - Processos por Status */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Processos por Status
          </h2>
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={MOCK_PROCESSES_BY_STATUS}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {MOCK_PROCESSES_BY_STATUS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            {/* Legenda do gráfico */}
            <div className="mt-4 space-y-2">
              {MOCK_PROCESSES_BY_STATUS.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-gray-900 font-semibold">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        </div>
      </div>
    </div>
  );
}
