import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getCalendlyOAuthStatus,
  getCalendlyAuthorizeUrl,
} from "../../services/appointments.service";
import { Dialog, DialogContent } from "../ui/dialog";
import { Alert } from "../ui/alert";
import Button from "../ui/button";

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss(); }}>
      <DialogContent
        open={open}
        title={
          <span className="flex items-center gap-2">
            <Calendar size={20} aria-hidden />
            Conecte seu Calendly
          </span>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            O Calendly é opcional e facilita o agendamento automático de
            reuniões com seus clientes.
          </p>

          <p className="text-sm text-ink-soft">
            Você pode continuar sem Calendly, cadastrar produtos e receber
            solicitações normalmente pela plataforma.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleConnect} disabled={loading} className="flex-1">
              {loading ? "Abrindo..." : "Conectar agora"}
            </Button>
            <Button variant="light" onClick={handleDismiss} className="flex-1">
              Continuar sem Calendly
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
