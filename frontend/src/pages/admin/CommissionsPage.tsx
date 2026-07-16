// Página consolidada de comissões (ADMIN) — plataforma, escritórios e especialistas
// num só lugar, editável a qualquer momento. Reaproveita os endpoints já
// existentes (platform-company, companies, specialists); não há endpoint novo.

import { useEffect, useState } from "react";
import { Percent, Save, AlertCircle, Check, Loader } from "lucide-react";
import {
  getPlatformCompany,
  updatePlatformCompany,
  type PlatformCompany,
} from "../../services/platform-company.service";
import {
  getCompanies,
  updateCompany,
  type Company,
} from "../../services/companies.service";
import {
  getSpecialists,
  updateSpecialist,
  type Specialist,
} from "../../services/specialists.service";

export default function CommissionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [platform, setPlatform] = useState<PlatformCompany | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);

  useEffect(() => {
    Promise.all([getPlatformCompany(), getCompanies(), getSpecialists()])
      .then(([platformData, companiesData, specialistsData]) => {
        setPlatform(platformData);
        setCompanies(companiesData);
        setSpecialists(specialistsData);
      })
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar comissões."),
      )
      .finally(() => setLoading(false));
  }, []);

  const savePlatformRate = async (rate: number) => {
    if (!platform) return;
    const updated = await updatePlatformCompany({
      name: platform.name,
      cnpj: platform.cnpj,
      bank: platform.bank,
      agency: platform.agency,
      checking_account: platform.checking_account,
      address: platform.address ?? undefined,
      cep: platform.cep ?? undefined,
      default_commission_rate: rate,
    });
    setPlatform(updated);
  };

  const saveCompanyRate = async (id: string, rate: number) => {
    const updated = await updateCompany(id, { commission_rate: rate });
    setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const saveSpecialistRate = async (id: string, rate: number) => {
    const updated = await updateSpecialist(id, { commission_rate: rate });
    setSpecialists((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="text-text-main w-full">
      <div className="flex items-center gap-3 mb-6">
        <Percent className="w-7 h-7 text-slate-700" />
        <div>
          <h1 className="h1-style">Comissões</h1>
          <p className="text-sm text-gray-500">
            Comissão de cada especialista, escritório e da plataforma — editável a
            qualquer momento.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Plataforma</h2>
        <p className="text-sm text-gray-500 mb-4">
          Taxa padrão usada quando especialista/escritório não têm taxa própria.
        </p>
        {platform && (
          <RateRow
            label={platform.name}
            initialRate={platform.default_commission_rate}
            onSave={savePlatformRate}
          />
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Escritórios</h2>
        <p className="text-sm text-gray-500 mb-4">
          Comissão de cada escritório parceiro.
        </p>
        <div className="flex flex-col gap-3">
          {companies.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum escritório cadastrado.</p>
          ) : (
            companies.map((company) => (
              <RateRow
                key={company.id}
                label={company.name}
                initialRate={company.commission_rate ?? 0}
                onSave={(rate) => saveCompanyRate(company.id, rate)}
              />
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Especialistas</h2>
        <p className="text-sm text-gray-500 mb-4">
          Comissão individual de cada especialista (usada quando não pertence a um
          escritório, ou sobrepõe a taxa do escritório quando definida).
        </p>
        <div className="flex flex-col gap-3">
          {specialists.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum especialista cadastrado.</p>
          ) : (
            specialists.map((specialist) => (
              <RateRow
                key={specialist.id}
                label={`${specialist.name} ${specialist.surname}`}
                initialRate={specialist.commission_rate ?? 0}
                onSave={(rate) => saveSpecialistRate(specialist.id, rate)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RateRow({
  label,
  initialRate,
  onSave,
}: {
  label: string;
  initialRate: number;
  onSave: (rate: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(initialRate));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const dirty = value !== String(initialRate);

  const handleSave = async () => {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setStatus("error");
      return;
    }
    setSaving(true);
    setStatus("idle");
    try {
      await onSave(rate);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
      <span className="flex-1 min-w-[160px] font-medium text-gray-800">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
        />
        <span className="text-gray-500 text-sm">%</span>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
      >
        {saving ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar
      </button>
      {status === "saved" && (
        <Check className="w-4 h-4 text-green-600" aria-label="Salvo" />
      )}
      {status === "error" && (
        <span className="text-xs text-red-600">Erro ao salvar</span>
      )}
    </div>
  );
}
