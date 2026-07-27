import { useState, useEffect } from "react";
import { Settings, Check, AlertCircle, Save, Video, X } from "lucide-react";
import { getSettings, updateSetting } from "../../services/settings.service";
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for editing
  const [minimumProposalEnabled, setMinimumProposalEnabled] = useState(false);
  const [minimumProposalPercentage, setMinimumProposalPercentage] =
    useState("80");

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

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getSettings();

        // Set local state from loaded settings
        const enabledSetting = data.find(
          (s) => s.key === "minimum_proposal_enabled",
        );
        const percentageSetting = data.find(
          (s) => s.key === "minimum_proposal_percentage",
        );

        if (enabledSetting) {
          setMinimumProposalEnabled(enabledSetting.value === "true");
        }
        if (percentageSetting) {
          setMinimumProposalPercentage(percentageSetting.value);
        }
      } catch (err) {
        setError(
          (err as any)?.friendlyMessage || (err instanceof Error ? err.message : "Erro ao carregar configurações"),
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Handle toggle minimum proposal enabled
  const handleToggleMinimumProposal = async () => {
    try {
      setIsSaving("minimum_proposal_enabled");
      const newValue = !minimumProposalEnabled;

      await updateSetting("minimum_proposal_enabled", String(newValue));

      setMinimumProposalEnabled(newValue);
      setSuccessMessage("Configuração atualizada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        (err as any)?.friendlyMessage || (err instanceof Error ? err.message : "Erro ao salvar configuração"),
      );
    } finally {
      setIsSaving(null);
    }
  };

  // Handle save minimum proposal percentage
  const handleSavePercentage = async () => {
    try {
      const percentage = Number(minimumProposalPercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        setError("A porcentagem deve ser um número entre 0 e 100");
        return;
      }

      setIsSaving("minimum_proposal_percentage");

      await updateSetting(
        "minimum_proposal_percentage",
        minimumProposalPercentage,
      );

      setSuccessMessage("Porcentagem atualizada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        (err as any)?.friendlyMessage || (err instanceof Error ? err.message : "Erro ao salvar configuração"),
      );
    } finally {
      setIsSaving(null);
    }
  };

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

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-ink"></div>
              <p className="mt-4 text-muted">Carregando configurações...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Proposals Settings Section */}
            <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border-soft bg-border-soft">
                <h2 className="text-lg font-semibold text-ink">
                  Configurações de Propostas
                </h2>
                <p className="text-sm text-muted mt-1">
                  Configure regras para propostas de negociação
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Enable/Disable Minimum Proposal */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor="minimumProposalEnabled"
                      className="text-sm font-medium text-ink"
                    >
                      Habilitar valor mínimo de proposta
                    </label>
                    <p className="text-sm text-muted mt-1">
                      Quando ativado, propostas devem ter no mínimo a
                      porcentagem definida abaixo do valor original do produto.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleMinimumProposal}
                    disabled={isSaving === "minimum_proposal_enabled"}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 ${
                      minimumProposalEnabled ? "bg-action" : "bg-border"
                    } ${
                      isSaving === "minimum_proposal_enabled"
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        minimumProposalEnabled
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Minimum Proposal Percentage */}
                {minimumProposalEnabled && (
                  <div className="pt-4 border-t border-border-soft">
                    <label
                      htmlFor="minimumProposalPercentage"
                      className="block text-sm font-medium text-ink mb-1"
                    >
                      Porcentagem mínima do valor original
                    </label>
                    <p className="text-sm text-muted mb-3">
                      Propostas devem ser no mínimo este percentual do valor do
                      produto. Por exemplo: 80% significa que uma proposta para
                      um produto de R$ 100.000 deve ser no mínimo R$ 80.000.
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="relative w-32">
                        <input
                          type="number"
                          id="minimumProposalPercentage"
                          value={minimumProposalPercentage}
                          onChange={(e) =>
                            setMinimumProposalPercentage(e.target.value)
                          }
                          min="0"
                          max="100"
                          className="w-full px-4 py-2 pr-8 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                          %
                        </span>
                      </div>
                      <Button
                        onClick={handleSavePercentage}
                        disabled={isSaving === "minimum_proposal_percentage"}
                      >
                        {isSaving === "minimum_proposal_percentage" ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save size={16} />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
        )}
      </div>
    </div>
  );
}
