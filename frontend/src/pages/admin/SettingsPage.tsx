import { useState, useEffect } from "react";
import { Settings, Check, AlertCircle, Video, X, Loader2 } from "lucide-react";
import {
  getGoogleMeetStatus,
  getGoogleMeetAuthorizeUrl,
  disconnectGoogleMeet,
  type GoogleMeetStatus,
} from "../../services/googleMeet.service";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";

/**
 * Admin Settings Page
 * Allows admins to configure system-wide settings
 */
export default function SettingsPage() {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google Meet connection state
  const [meetStatus, setMeetStatus] = useState<GoogleMeetStatus | null>(null);
  const [meetBusy, setMeetBusy] = useState(false);

  const loadMeetStatus = async () => {
    try {
      const status = await getGoogleMeetStatus();
      setMeetStatus(status);
    } catch {
      // status indisponível não bloqueia a tela de configurações
      setMeetStatus(null);
    }
  };

  const handleConnectMeet = async () => {
    try {
      setMeetBusy(true);
      const url = await getGoogleMeetAuthorizeUrl();
      window.location.href = url;
    } catch (err) {
      setError(
        (err as any)?.friendlyMessage ||
          (err instanceof Error ? err.message : "Erro ao iniciar conexão Google"),
      );
      setMeetBusy(false);
    }
  };

  const handleDisconnectMeet = async () => {
    try {
      setMeetBusy(true);
      await disconnectGoogleMeet();
      await loadMeetStatus();
      setSuccessMessage("Conta Google desconectada.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        (err as any)?.friendlyMessage ||
          (err instanceof Error ? err.message : "Erro ao desconectar"),
      );
    } finally {
      setMeetBusy(false);
    }
  };

  // Feedback do retorno do callback OAuth (?google=connected|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      setSuccessMessage("Conta Google conectada para reuniões!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } else if (google === "error") {
      setError(
        "Falha ao conectar a conta Google. Verifique se é uma conta Workspace e tente novamente.",
      );
    }
    if (google) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    loadMeetStatus();
  }, []);

  return (
    <div className="text-text-main w-full">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings size={24} className="text-ink-soft" />
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink">
              Configurações do Sistema
            </h1>
            <p className="text-sm text-muted mt-1">
              Gerencie as configurações gerais da plataforma
            </p>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Alert variant="success" className="mb-6">
            <Check size={20} />
            <p>{successMessage}</p>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" className="mb-6">
            <AlertCircle size={20} />
            <p className="flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-status-bad hover:opacity-70"
            >
              <X size={16} />
            </button>
          </Alert>
        )}

        <div className="space-y-6">
            {/* Google Meet Connection Section */}
            <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border-soft bg-border-soft">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Video size={18} className="text-ink-soft" />
                  Reuniões — Conta Google Meet
                </h2>
                <p className="text-sm text-muted mt-1">
                  Conecte uma conta Google Workspace para gerar as salas de
                  reunião. A conta precisa ser Workspace (contas @gmail.com
                  comuns não geram link do Meet via API).
                </p>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {meetStatus?.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-ok-wash text-status-ok">
                          <Check size={12} /> Conectado
                        </span>
                        <span className="text-sm text-ink-soft">
                          {meetStatus.google_email}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-border-soft text-ink-soft">
                        Nenhuma conta conectada
                      </span>
                    )}
                    {meetStatus?.last_error && (
                      <p className="text-sm text-status-bad mt-2">
                        Erro na conexão ({meetStatus.last_error}). Reconecte a
                        conta.
                      </p>
                    )}
                  </div>

                  {meetStatus?.connected ? (
                    <Button
                      variant="light"
                      onClick={handleDisconnectMeet}
                      disabled={meetBusy}
                    >
                      Desconectar
                    </Button>
                  ) : (
                    <Button onClick={handleConnectMeet} disabled={meetBusy}>
                      {meetBusy ? (
                        <Loader2 className="animate-spin h-4 w-4 text-white" />
                      ) : (
                        <Video size={16} />
                      )}
                      Conectar conta Google
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Info Box */}
            <Alert variant="info">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">
                  Sobre as configurações
                </h4>
                <p className="text-sm mt-1">
                  As alterações nas configurações são aplicadas imediatamente
                  para todas as novas negociações. Processos em andamento não
                  são afetados retroativamente.
                </p>
              </div>
            </Alert>
        </div>
      </div>
    </div>
  );
}
