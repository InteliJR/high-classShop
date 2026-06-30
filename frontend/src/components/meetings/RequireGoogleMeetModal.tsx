import { useEffect, useState } from "react";
import { Video, X } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getGoogleMeetStatus,
  getGoogleMeetAuthorizeUrl,
} from "../../services/googleMeet.service";

const DISMISS_KEY = "google-meet-modal-dismissed-session";

/**
 * Pop-up exibido para o ADMIN quando não há conta Google conectada.
 * Sem a conexão, as reuniões não conseguem gerar link do Google Meet.
 * Aparece a cada nova sessão de login (dispensável durante a sessão).
 */
export default function RequireGoogleMeetModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    getGoogleMeetStatus()
      .then((status) => {
        if (!cancelled && !status.connected) {
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
      const url = await getGoogleMeetAuthorizeUrl();
      window.location.href = url;
    } catch (err) {
      const e = err as { friendlyMessage?: string };
      setError(e.friendlyMessage || "Erro ao iniciar conexão com o Google.");
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
        <div className="bg-linear-to-br from-emerald-600 to-teal-600 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Video size={28} />
            <h2 className="text-xl font-bold">Conecte a conta Google Meet</h2>
          </div>
          <p className="text-sm text-emerald-50">
            Para que os especialistas possam criar reuniões no Google Meet,
            conecte uma conta Google Workspace à plataforma.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Sem uma conta conectada, as reuniões não geram link do Google Meet.
            A conta precisa ser Google Workspace (contas @gmail.com comuns não
            criam reunião via API).
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
