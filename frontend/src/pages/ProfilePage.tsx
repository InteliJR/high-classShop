import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Calendar, User, Lock } from "lucide-react";
import { useAuth } from "../store/authStateManager";
import {
  getUserById,
  updateUser,
  type UpdateUserData,
} from "../services/users.service";

/**
 * CustomerProfilePage
 *
 * Página para editar as informações do usuário logado.
 *
 * Tabs:
 * - Dados Pessoais: nome, sobrenome, cpf, rg
 *   - Para especialistas: campo destacado calendly_url
 * - Alterar Senha: desabilitada com mensagem "Em breve"
 */
export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"personal" | "password">(
    "personal"
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    cpf: "",
    rg: "",
    calendly_url: "",
  });

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
        dataToUpdate.calendly_url = formData.calendly_url;
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
        /* Tab Alterar Senha - Desabilitada */
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Lock size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Alterar Senha
          </h2>
          <p className="text-gray-500">
            Esta funcionalidade será adicionada em breve.
          </p>
          <div className="mt-4 inline-block px-4 py-2 bg-gray-200 text-gray-600 rounded-full text-sm">
            Em desenvolvimento
          </div>
        </div>
      )}
    </div>
  );
}
