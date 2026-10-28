import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import {
  AdminSpecialistJourneyProvider,
} from "../../contexts/AdminSpecialistJourneyContext";
import {
  persistAdminSpecialistTarget,
  readAdminSpecialistTarget,
} from "../../lib/admin-specialist-journey";
import {
  getSpecialists,
  type Specialist,
} from "../../services/specialists.service";
import { useAuth } from "../../store/authStateManager";
import { Alert } from "../ui/alert";

function clearTransientJourneyState(): void {
  if (typeof window === "undefined") return;
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith("contract-preview-operation:")) {
      window.sessionStorage.removeItem(key);
    }
  }
}

export default function AdminSpecialistJourneyShell({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const admin = useAuth((state) => state.user);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedId, setSelectedId] = useState(readAdminSpecialistTarget());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSpecialists()
      .then((items) => {
        const activeItems = items.filter((item) => item.is_active !== false);
        setSpecialists(activeItems);
        const stored = readAdminSpecialistTarget();
        if (stored && !activeItems.some((item) => item.id === stored)) {
          persistAdminSpecialistTarget(null);
          setSelectedId(null);
        }
      })
      .catch(() => setError("Não foi possível carregar os especialistas."))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => specialists.find((item) => item.id === selectedId) ?? null,
    [selectedId, specialists],
  );

  const changeSpecialist = (nextId: string) => {
    const normalized = nextId || null;
    persistAdminSpecialistTarget(normalized);
    clearTransientJourneyState();
    setSelectedId(normalized);
    navigate("/admin/journey", { replace: true });
  };

  return (
    <div className="w-full space-y-5">
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <BriefcaseBusiness size={20} />
              <h1 className="text-xl font-semibold">Jornada comercial assistida</h1>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              O administrador executa as ações; o especialista escolhido continua
              sendo o responsável comercial.
            </p>
          </div>
          <label className="min-w-72 text-sm font-medium text-ink">
            Especialista representado
            <select
              aria-label="Especialista representado"
              value={selectedId ?? ""}
              onChange={(event) => changeSpecialist(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
              disabled={loading}
            >
              <option value="">Selecione um especialista</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name} {specialist.surname} · {specialist.speciality}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Carregando especialistas…
          </p>
        )}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {selected && (
          <div className="mt-4 rounded-lg bg-brand-container px-4 py-3 text-sm text-ink">
            <strong>Operando em nome de {selected.name} {selected.surname}</strong>
            <span className="ml-2 text-ink-soft">
              Executor: {admin?.name} {admin?.surname} (ADMIN)
            </span>
          </div>
        )}

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Etapas da jornada">
          {[
            ["/admin/journey", "Visão geral"],
            ["/admin/journey/products", "Catálogo"],
            ["/admin/journey/processes", "Processos e agenda"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin/journey"}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-ink text-surface"
                    : "bg-border-soft text-ink-soft hover:text-ink"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </section>

      {!loading && !selected && !error && (
        <Alert variant="info">
          Escolha um especialista ativo para abrir catálogo, processos,
          reuniões, propostas e contratos.
        </Alert>
      )}

      {selected && (
        <AdminSpecialistJourneyProvider
          value={{ specialist: selected, targetSpecialistId: selected.id }}
        >
          {children}
        </AdminSpecialistJourneyProvider>
      )}
    </div>
  );
}
