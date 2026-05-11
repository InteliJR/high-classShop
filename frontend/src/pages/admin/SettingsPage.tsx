import { useState, useEffect } from "react";
import { Settings, Check, AlertCircle, Save } from "lucide-react";
import { getSettings, updateSetting } from "../../services/settings.service";

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Settings size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                Configurações do Sistema
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Gerencie as configurações gerais da plataforma
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check size={20} className="text-green-600" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-slate-700"></div>
              <p className="mt-4 text-gray-600">Carregando configurações...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Proposals Settings Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Configurações de Propostas
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure regras para propostas de negociação
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Enable/Disable Minimum Proposal */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor="minimumProposalEnabled"
                      className="text-sm font-medium text-gray-900"
                    >
                      Habilitar valor mínimo de proposta
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Quando ativado, propostas devem ter no mínimo a
                      porcentagem definida abaixo do valor original do produto.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleMinimumProposal}
                    disabled={isSaving === "minimum_proposal_enabled"}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                      minimumProposalEnabled ? "bg-slate-700" : "bg-gray-200"
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
                  <div className="pt-4 border-t border-gray-100">
                    <label
                      htmlFor="minimumProposalPercentage"
                      className="block text-sm font-medium text-gray-900 mb-1"
                    >
                      Porcentagem mínima do valor original
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
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
                          className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                          %
                        </span>
                      </div>
                      <button
                        onClick={handleSavePercentage}
                        disabled={isSaving === "minimum_proposal_percentage"}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
                      >
                        {isSaving === "minimum_proposal_percentage" ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save size={16} />
                        )}
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Sobre as configurações
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    As alterações nas configurações são aplicadas imediatamente
                    para todas as novas negociações. Processos em andamento não
                    são afetados retroativamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
