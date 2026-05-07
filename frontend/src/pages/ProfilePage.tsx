import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Calendar, User, Lock } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../store/authStateManager";
import {
  getUserById,
  updateUser,
  type UpdateUserData,
} from "../services/users.service";
import {
  disconnectCalendlyOAuth,
  getCalendlyAuthorizeUrl,
  getCalendlyOAuthStatus,
  type CalendlyOAuthStatus,
} from "../services/appointments.service";

/**
 * CustomerProfilePage
 *
 * Página para editar as informações do usuário logado.
 *
 * Tabs:
 * - Dados Pessoais: nome, sobrenome, cpf, rg
 *   - Para especialistas: campo destacado calendly_url
 * - Alterar Senha: formulário para trocar senha via PATCH /auth/change-password
 */
export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"personal" | "password">(
    "personal",
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calendlyOAuthStatus, setCalendlyOAuthStatus] =
    useState<CalendlyOAuthStatus | null>(null);
  const [loadingCalendlyOAuth, setLoadingCalendlyOAuth] = useState(false);
  const [processingCalendlyOAuth, setProcessingCalendlyOAuth] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    cpf: "",
    rg: "",
    calendly_url: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Carregar dados do usuário
  useEffect(() => {
    async function loadUserData() {
      if (!user?.id) return;

      setLoading(true);
      try {
        const userData = await getUserById(user.id);
        setFormData({
          name: userData.name || "",
          surname: userData.surname || "",
          cpf: userData.cpf || "",
          rg: userData.rg || "",
          calendly_url: userData.calendly_url || "",
        });
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setError("Erro ao carregar dados do usuário");
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [user?.id]);

  useEffect(() => {
    async function loadCalendlyStatus() {
      if (!user?.id || user.role !== "SPECIALIST") return;

      setLoadingCalendlyOAuth(true);
      try {
        const status = await getCalendlyOAuthStatus();
        setCalendlyOAuthStatus(status);
      } catch {
        setCalendlyOAuthStatus(null);
      } finally {
        setLoadingCalendlyOAuth(false);
      }
    }

    loadCalendlyStatus();
  }, [user?.id, user?.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendly = params.get("calendly");
    const reason = params.get("reason");

    if (calendly === "connected") {
      setSuccess("Conta Calendly conectada com sucesso!");
    }

    if (calendly === "error") {
      setError(
        `Falha ao conectar Calendly${reason ? `: ${decodeURIComponent(reason)}` : ""}`,
      );
    }

    if (calendly) {
      params.delete("calendly");
      params.delete("reason");
      const query = params.toString();
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const handleCalendlyConnect = async () => {
    setProcessingCalendlyOAuth(true);
    setError(null);

    try {
      const authorizeUrl = await getCalendlyAuthorizeUrl();
      window.location.href = authorizeUrl;
    } catch {
      setError("Não foi possível iniciar a conexão com o Calendly");
      setProcessingCalendlyOAuth(false);
    }
  };

  const handleCalendlyDisconnect = async () => {
    setProcessingCalendlyOAuth(true);
    setError(null);
    setSuccess(null);

    try {
      await disconnectCalendlyOAuth();
      setCalendlyOAuthStatus({
        connected: false,
        calendly_user_uri: null,
        expires_at: null,
        is_active: false,
      });
      setSuccess("Integração Calendly desconectada com sucesso.");
    } catch {
      setError("Não foi possível desconectar o Calendly");
    } finally {
      setProcessingCalendlyOAuth(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const dataToUpdate: UpdateUserData = {
        name: formData.name,
        surname: formData.surname,
        cpf: formData.cpf,
        rg: formData.rg,
      };

      // Só envia calendly_url se for especialista
      if (user.role === "SPECIALIST") {
        const trimmedUrl = formData.calendly_url?.trim();
        dataToUpdate.calendly_url = trimmedUrl || undefined;
      }

      await updateUser(user.id, dataToUpdate);
      setSuccess("Dados atualizados com sucesso!");
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError("CPF ou RG já cadastrado no sistema");
      } else {
        setError("Erro ao salvar alterações");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("A nova senha e a confirmação não coincidem");
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch(
        "/auth/change-password",
        {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        },
        { withCredentials: true },
      );
      setPasswordSuccess("Senha alterada com sucesso!");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: any) {
      if (err.response?.status === 401) {
        setPasswordError("Senha atual incorreta");
      } else {
        setPasswordError("Erro ao alterar senha. Tente novamente.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === "personal"
              ? "border-black text-black font-medium"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <User size={18} />
          Dados Pessoais
        </button>
        <button
          onClick={() => setActiveTab("password")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === "password"
              ? "border-black text-black font-medium"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Lock size={18} />
          Alterar Senha
        </button>
      </div>

      {/* Mensagens de erro/sucesso */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "personal" ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Informações Pessoais</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>

              {/* Sobrenome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sobrenome
                </label>
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>

              {/* CPF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  maxLength={11}
                  placeholder="Apenas números"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>

              {/* RG */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleInputChange}
                  maxLength={10}
                  placeholder="Apenas números"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Link do Calendly - Apenas para especialistas */}
          {user?.role === "SPECIALIST" && (
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={24} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-900">
                  Integração Calendly
                </h2>
              </div>

              <p className="text-sm text-blue-700 mb-4">
                Configure seu link do Calendly para que clientes possam agendar
                reuniões diretamente com você.
              </p>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">
                  URL do Calendly
                </label>
                <input
                  type="url"
                  name="calendly_url"
                  value={formData.calendly_url}
                  onChange={handleInputChange}
                  placeholder="https://calendly.com/seu-usuario"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>

              <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  Conexão OAuth (recomendado para sincronização automática)
                </p>
                {loadingCalendlyOAuth ? (
                  <p className="text-sm text-blue-700">Verificando status...</p>
                ) : (
                  <>
                    <p className="text-sm text-blue-700 mb-3">
                      Status:{" "}
                      {calendlyOAuthStatus?.connected
                        ? "Conectado"
                        : "Não conectado"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCalendlyConnect}
                        disabled={processingCalendlyOAuth}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {processingCalendlyOAuth
                          ? "Processando..."
                          : calendlyOAuthStatus?.connected
                            ? "Reconectar Calendly"
                            : "Conectar Calendly"}
                      </button>
                      {calendlyOAuthStatus?.connected && (
                        <button
                          type="button"
                          onClick={handleCalendlyDisconnect}
                          disabled={processingCalendlyOAuth}
                          className="px-4 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          Desconectar
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Alterar Senha</h2>

            {passwordError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha atual
                </label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Lock size={18} />
              {savingPassword ? "Salvando..." : "Alterar Senha"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
