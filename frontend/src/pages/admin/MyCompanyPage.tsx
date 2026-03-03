import { useState, useEffect } from "react";
import { Building2, Save, AlertCircle, Check, Loader } from "lucide-react";
import {
  getPlatformCompany,
  updatePlatformCompany,
} from "../../services/platform-company.service";
import Button from "../../components/ui/button";

/**
 * Página "Minha Empresa" - Admin
 * Permite ao admin configurar os dados da empresa dona da plataforma.
 * Esses dados são usados para preencher automaticamente a seção
 * "Dados da Plataforma (Comissão)" nos contratos.
 */
export default function MyCompanyPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [bank, setBank] = useState("");
  const [agency, setAgency] = useState("");
  const [checkingAccount, setCheckingAccount] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [defaultCommissionRate, setDefaultCommissionRate] = useState("");

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getPlatformCompany();
        if (data) {
          setName(data.name);
          setCnpj(data.cnpj);
          setBank(data.bank);
          setAgency(data.agency);
          setCheckingAccount(data.checking_account);
          setAddress(data.address || "");
          setCep(data.cep || "");
          setDefaultCommissionRate(String(data.default_commission_rate));
        }
      } catch (err) {
        setError(
          (err as Error).message || "Erro ao carregar dados da empresa.",
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!name || !cnpj || !bank || !agency || !checkingAccount) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    const rate = parseFloat(defaultCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError("Taxa de comissão deve ser um número entre 0 e 100.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updatePlatformCompany({
        name,
        cnpj,
        bank,
        agency,
        checking_account: checkingAccount,
        address: address || undefined,
        cep: cep || undefined,
        default_commission_rate: rate,
      });

      setSuccessMessage("Dados da empresa atualizados com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError((err as Error).message || "Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Building2 className="w-8 h-8 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minha Empresa</h1>
          <p className="text-sm text-gray-500">
            Dados da empresa dona da plataforma. Usados automaticamente nos
            contratos.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <Check className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{successMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
            Dados Gerais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razão Social *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ *
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                maxLength={18}
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Paulista, 1000 - São Paulo/SP"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                maxLength={9}
                placeholder="00000-000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
            Dados Bancários
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banco *
              </label>
              <input
                type="text"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="Ex: Banco do Brasil"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agência *
              </label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                maxLength={10}
                placeholder="Ex: 0001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conta Corrente *
              </label>
              <input
                type="text"
                value={checkingAccount}
                onChange={(e) => setCheckingAccount(e.target.value)}
                maxLength={20}
                placeholder="Ex: 12345-6"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                required
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
            Comissão Padrão
          </h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Taxa Padrão de Comissão (%) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={defaultCommissionRate}
              onChange={(e) => setDefaultCommissionRate(e.target.value)}
              placeholder="Ex: 10.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Usada quando o especialista ou sua empresa não possuem taxa
              individual definida.
            </p>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Salvar
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
