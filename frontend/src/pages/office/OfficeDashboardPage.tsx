import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { officeService } from "../../services/office";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";
import { useAuth } from "../../store/authStateManager";
import { DEFAULT_BRAND_PRIMARY, DEFAULT_BRAND_SECONDARY } from "../../utils/branding";

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
  const user = useAuth((s) => s.user);
  const slug = user?.company?.slug;
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const siteUrl = slug ? `${window.location.origin}/i/${slug}` : null;

  useEffect(() => {
    if (!siteModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSiteModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [siteModalOpen]);

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

      {siteUrl && (
        <div className="mb-8">
          <button
            onClick={() => setSiteModalOpen(true)}
            style={{ backgroundColor: DEFAULT_BRAND_PRIMARY, color: "#fff" }}
            className="rounded-md px-4 py-2 text-sm font-medium"
          >
            Meu site do escritório
          </button>
          {siteModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => setSiteModalOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="office-site-modal-title"
                className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
                style={{ borderTop: `4px solid ${DEFAULT_BRAND_SECONDARY}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSiteModalOpen(false)}
                  aria-label="Fechar"
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
                <h2
                  id="office-site-modal-title"
                  className="mb-2 text-lg font-semibold"
                  style={{ color: DEFAULT_BRAND_SECONDARY }}
                >
                  Seu site whitelabel
                </h2>
                <p className="mb-4 text-sm text-gray-600">
                  Compartilhe este link — quem se cadastrar por ele vira cliente do seu escritório.
                </p>
                <code className="block break-all rounded bg-gray-100 p-3 text-sm">{siteUrl}</code>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(siteUrl)}
                    style={{ backgroundColor: DEFAULT_BRAND_PRIMARY, color: "#fff" }}
                    className="rounded-md px-4 py-2 text-sm"
                  >
                    Copiar link
                  </button>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border px-4 py-2 text-sm"
                    style={{ borderColor: DEFAULT_BRAND_PRIMARY, color: DEFAULT_BRAND_SECONDARY }}
                  >
                    Abrir
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
