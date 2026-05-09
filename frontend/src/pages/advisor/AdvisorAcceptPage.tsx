import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import { acceptAdvisorInvite } from "../../services/advisor.service";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Convite de Assessor</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-slate-600" />
            <p className="text-gray-600">Validando convite...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-gray-800 font-medium">Convite aceito com sucesso!</p>
            <p className="text-sm text-gray-500">
              Você agora é assessor deste cliente. Acesse seu painel para acompanhar os processos.
            </p>
            <button
              onClick={() => navigate("/advisor/dashboard")}
              className="mt-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium"
            >
              Ir para o painel
            </button>
          </div>
        )}

        {status === "already" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-blue-500" />
            <p className="text-gray-800 font-medium">Convite já aceito anteriormente</p>
            <button
              onClick={() => navigate("/advisor/dashboard")}
              className="mt-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium"
            >
              Ir para o painel
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-gray-800 font-medium">Não foi possível aceitar o convite</p>
            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium"
            >
              Voltar ao início
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
