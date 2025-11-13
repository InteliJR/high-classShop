import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardPage() {
  // Mock data para gráfico de vendas
  const vendidosData = [
    { month: 'Jan', vendidos: 400, naoVendidos: 240 },
    { month: 'Fev', vendidos: 300, naoVendidos: 221 },
    { month: 'Mar', vendidos: 200, naoVendidos: 229 },
    { month: 'Abr', vendidos: 278, naoVendidos: 200 },
    { month: 'Mai', vendidos: 189, naoVendidos: 220 },
    { month: 'Jun', vendidos: 239, naoVendidos: 229 },
    { month: 'Jul', vendidos: 349, naoVendidos: 200 },
    { month: 'Ago', vendidos: 430, naoVendidos: 210 },
    { month: 'Set', vendidos: 490, naoVendidos: 229 },
    { month: 'Out', vendidos: 490, naoVendidos: 200 },
    { month: 'Nov', vendidos: 590, naoVendidos: 200 },
    { month: 'Dez', vendidos: 690, naoVendidos: 229 },
  ];

  // Mock data para gráfico de desempenho por consultor
  const desempenhoData = [
    { name: 'User Name', value: 1200000, percentage: '+8.2%' },
    { name: 'User Name', value: 800000, percentage: '+7%' },
    { name: 'User Name', value: 645000, percentage: '+23%' },
    { name: 'User Name', value: 590000, percentage: '+15%' },
    { name: 'User Name', value: 534200, percentage: '+17%' },
  ];

  const pieData = [
    { name: 'User Name', value: 1200000 },
    { name: 'User Name', value: 800000 },
    { name: 'User Name', value: 645000 },
    { name: 'User Name', value: 590000 },
    { name: 'User Name', value: 534200 },
  ];

  const COLORS = ['#3B82F6', '#1E40AF', '#1E3A8A', '#0C2340', '#051E3E'];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Seja bem vindo de volta, Administrador!
        </h1>
        <p className="text-gray-600">
          Lorem ipsum dolor sit amet. Quo recusant accusamus quo lorem repudiandae quo sed
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {/* Card 1: Processos Ativos */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Processos Ativos</p>
          <p className="text-4xl font-bold text-gray-900 mb-2">165</p>
          <p className="text-sm text-gray-600">+15% vs mês anterior</p>
        </div>

        {/* Card 2: Taxa de Conversão */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Taxa de Conversão</p>
          <p className="text-4xl font-bold text-gray-900 mb-2">69%</p>
          <p className="text-sm text-gray-600">Meta 80%</p>
        </div>

        {/* Card 3: Escritórios Ativos */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Escritórios Ativos</p>
          <p className="text-4xl font-bold text-gray-900 mb-2">12</p>
          <p className="text-sm text-gray-600">2 novos neste mês</p>
        </div>

        {/* Card 4: Nível de Satisfação (NPS) */}
        <div className="bg-gray-300 rounded-lg p-6">
          <p className="text-gray-700 font-semibold mb-2">Nível de Satisfação (NPS)</p>
          <p className="text-4xl font-bold text-gray-900 mb-2">4.5</p>
          <p className="text-sm text-gray-600">De 5 estrelas</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <div className="col-span-2 bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendas</h2>
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
            <LineChart data={vendidosData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="naoVendidos" stroke="#EF4444" />
              <Line type="monotone" dataKey="vendidos" stroke="#22C55E" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Desempenho por Consultor */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Desempenho de Vendas por Consultor
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Legenda do gráfico */}
          <div className="mt-4 space-y-2">
            {desempenhoData.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-gray-900 font-semibold">
                    ${(item.value / 1000).toFixed(1)}K
                  </span>
                  <span className="text-green-600 font-semibold">{item.percentage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

