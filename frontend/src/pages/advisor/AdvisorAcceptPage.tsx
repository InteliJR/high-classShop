import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import { acceptAdvisorInvite } from "../../services/advisor.service";
import Button from "../../components/ui/button";

export default function AdvisorAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Link de convite inválido. Verifique o e-mail recebido.");
      return;
    }

    if (!user) {
      // Redirect to login preserving return URL
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (status !== "idle") return;
    setStatus("loading");

    acceptAdvisorInvite(token)
      .then((result) => {
        setStatus(result.already_accepted ? "already" : "success");
      })
      .catch((err: any) => {
        setStatus("error");
        setErrorMsg(
          err.friendlyMessage ||
          err.response?.data?.message ||
          "Não foi possível aceitar o convite. O link pode ter expirado.",
        );
      });
  }, [token, user, navigate, status]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-surface rounded-xl border border-border shadow-ds-card max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-bold text-ink mb-6">Convite de Assessor</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-ink-soft" />
            <p className="text-muted">Validando convite...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-status-ok" />
            <p className="text-ink-soft font-medium">Convite aceito com sucesso!</p>
            <p className="text-sm text-muted">
              Você agora é assessor deste cliente. Acesse seu painel para acompanhar os processos.
            </p>
            <Button onClick={() => navigate("/advisor/dashboard")} className="mt-2">
              Ir para o painel
            </Button>
          </div>
        )}

        {status === "already" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-status-sched" />
            <p className="text-ink-soft font-medium">Convite já aceito anteriormente</p>
            <Button onClick={() => navigate("/advisor/dashboard")} className="mt-2">
              Ir para o painel
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-status-bad" />
            <p className="text-ink-soft font-medium">Não foi possível aceitar o convite</p>
            {errorMsg && <p className="text-sm text-status-bad">{errorMsg}</p>}
            <Button onClick={() => navigate("/")} className="mt-2">
              Voltar ao início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
