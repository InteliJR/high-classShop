import { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getCalendlyOAuthStatus,
  getCalendlyAuthorizeUrl,
} from "../../services/appointments.service";

const DISMISS_KEY = "calendly-modal-dismissed-session";

export default function RequireCalendlyModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "SPECIALIST") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    getCalendlyOAuthStatus()
      .then((status) => {
        if (!cancelled && !status.is_active) {
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await getCalendlyAuthorizeUrl();
      window.location.href = url;
    } catch (err) {
      const e = err as { friendlyMessage?: string };
      setError(e.friendlyMessage || "Erro ao iniciar conexão com o Calendly.");
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-linear-to-br from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={28} />
            <h2 className="text-xl font-bold">Conecte seu Calendly</h2>
          </div>
          <p className="text-sm text-blue-50">
            Para que clientes possam agendar reuniões com você, conecte sua
            conta do Calendly à plataforma.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Sem a conexão ativa, clientes não conseguem marcar agendamentos com
            você e seu fluxo de negociação fica bloqueado.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Abrindo..." : "Conectar agora"}
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Lembrar mais tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
