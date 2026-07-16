import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { officeService } from "../../services/office";

interface Stats {
  companyId: string;
  activeConsultants: number;
  inactiveConsultants: number;
  clientsCount: number;
  openProcesses: number;
}

export default function OfficeDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    officeService
      .dashboard()
      .then((d) => setStats(d as Stats))
      .catch((e) =>
        setError((e as { friendlyMessage?: string }).friendlyMessage || "Erro ao carregar dashboard"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!stats) return null;

  return (
    <div className="w-full p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel do Escritório</h1>
        <p className="text-gray-600">Gerencie consultores, clientes e configurações da empresa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card title="Consultores ativos" value={stats.activeConsultants} />
        <Card title="Consultores inativos" value={stats.inactiveConsultants} />
        <Card title="Clientes" value={stats.clientsCount} />
        <Card title="Processos abertos" value={stats.openProcesses} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard to="/office/consultants" label="Gerenciar consultores" />
        <ActionCard to="/office/consultants?tab=batch" label="Convidar em lote (CSV)" />
        <ActionCard to="/office/company" label="Configurar escritório" />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

function ActionCard({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="block bg-gray-900 hover:bg-gray-800 text-white font-medium py-4 px-6 rounded-lg shadow text-center"
    >
      {label}
    </Link>
  );
}
