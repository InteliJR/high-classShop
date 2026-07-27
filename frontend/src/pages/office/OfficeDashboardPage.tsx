import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { officeService } from "../../services/office";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";

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

  if (loading) return <div className="p-8 text-muted">Carregando...</div>;
  if (error) return <div className="p-8 text-status-bad">{error}</div>;
  if (!stats) return null;

  return (
    <div className="w-full p-8">
      <PageHeader title="Painel do Escritório" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-muted">Consultores ativos</p>
          <p className="text-3xl font-bold text-ink mt-2">{stats.activeConsultants}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Consultores inativos</p>
          <p className="text-3xl font-bold text-ink mt-2">{stats.inactiveConsultants}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Clientes</p>
          <p className="text-3xl font-bold text-ink mt-2">{stats.clientsCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Processos abertos</p>
          <p className="text-3xl font-bold text-ink mt-2">{stats.openProcesses}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard to="/office/consultants" label="Gerenciar consultores" />
        <ActionCard to="/office/consultants?tab=batch" label="Convidar em lote (CSV)" />
        <ActionCard to="/office/company" label="Configurar escritório" />
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
