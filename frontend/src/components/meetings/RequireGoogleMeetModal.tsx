import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getGoogleMeetStatus,
  getGoogleMeetAuthorizeUrl,
} from "../../services/googleMeet.service";
import { Dialog, DialogContent } from "../ui/dialog";
import { Alert } from "../ui/alert";
import Button from "../ui/button";

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss(); }}>
      <DialogContent
        open={open}
        title={
          <span className="flex items-center gap-2">
            <Video size={20} aria-hidden />
            Conecte a conta Google Meet
          </span>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Para que os especialistas possam criar reuniões no Google Meet,
            conecte uma conta Google Workspace à plataforma.
          </p>

          <p className="text-sm text-ink-soft">
            Sem uma conta conectada, as reuniões não geram link do Google Meet.
            A conta precisa ser Google Workspace (contas @gmail.com comuns não
            criam reunião via API).
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleConnect} disabled={loading} className="flex-1">
              {loading ? "Abrindo..." : "Conectar agora"}
            </Button>
            <Button variant="light" onClick={handleDismiss} className="flex-1">
              Lembrar mais tarde
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
