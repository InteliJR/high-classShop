// Página consolidada de comissões (ADMIN). Duas abas:
//  - "Configurar taxas": edição das fatias (plataforma, escritórios, especialistas).
//  - "Por venda": fluxo de comissão de cada venda fechada (quanto vai para cada parte).

import { useEffect, useState, type ReactNode } from "react";
import {
  Percent,
  Save,
  AlertCircle,
  Check,
  Loader,
  Sliders,
  Receipt,
  Download,
  FileText,
} from "lucide-react";
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
import {
  getSalesCommissions,
  type SaleCommission,
} from "../../services/commissions.service";
import { openPrintablePdf } from "../../utils/export";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function exportSalesCsv(sales: SaleCommission[]) {
  const header = [
    "Produto",
    "Cliente",
    "Especialista",
    "Venda",
    "Comissao total",
    "% total",
    "Especialista (R$)",
    "Escritorio",
    "Escritorio (R$)",
    "Plataforma (R$)",
    "Assinado em",
  ];
  const rows = sales.map((s) => [
    s.productLabel,
    s.clientName,
    s.specialistName,
    s.saleValue,
    s.totalCommission,
    s.totalCommissionRate,
    s.specialistValue,
    s.officeName ?? "",
    s.officeValue,
    s.platformValue,
    s.signedAt ? new Date(s.signedAt).toLocaleDateString("pt-BR") : "",
  ]);
  const escape = (v: string | number) => {
    const str = String(v);
    return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  // Separador ";" e BOM UTF-8 para abrir corretamente no Excel pt-BR.
  const csv = [header, ...rows]
    .map((r) => r.map(escape).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "comissoes-por-venda.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportSalesPdf(sales: SaleCommission[]) {
  const header = [
    "Produto",
    "Cliente",
    "Especialista",
    "Venda",
    "Comissão total",
    "% total",
    "Especialista (R$)",
    "Escritório",
    "Escritório (R$)",
    "Plataforma (R$)",
    "Assinado em",
  ];
  const rows = sales.map((s) => [
    s.productLabel,
    s.clientName,
    s.specialistName,
    s.saleValue,
    s.totalCommission,
    s.totalCommissionRate,
    s.specialistValue,
    s.officeName ?? "",
    s.officeValue,
    s.platformValue,
    s.signedAt ? new Date(s.signedAt).toLocaleDateString("pt-BR") : "",
  ]);
  openPrintablePdf("Comissões por venda", header, rows);
}

type Tab = "config" | "sales";

export default function CommissionsPage() {
  const [tab, setTab] = useState<Tab>("config");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);

  useEffect(() => {
    Promise.all([getCompanies(), getSpecialists()])
      .then(([companiesData, specialistsData]) => {
        setCompanies(companiesData);
        setSpecialists(specialistsData);
      })
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar comissões."),
      )
      .finally(() => setLoading(false));
  }, []);

  const saveCompanyRate = async (id: string, rate: number) => {
    const updated = await updateCompany(id, { commission_rate: rate });
    setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const saveSpecialistRate = async (id: string, rate: number) => {
    const updated = await updateSpecialist(id, { commission_rate: rate });
    setSpecialists((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  return (
    <div className="text-text-main w-full">
      <div className="flex items-center gap-3 mb-6">
        <Percent className="w-7 h-7 text-slate-700" />
        <div>
          <h1 className="h1-style">Comissões</h1>
          <p className="text-sm text-gray-500">
            Comissão de cada especialista, escritório e da plataforma — e o fluxo
            de cada venda.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabButton
          active={tab === "config"}
          onClick={() => setTab("config")}
          icon={<Sliders className="w-4 h-4" />}
          label="Configurar taxas"
        />
        <TabButton
          active={tab === "sales"}
          onClick={() => setTab("sales")}
          icon={<Receipt className="w-4 h-4" />}
          label="Por venda"
        />
      </div>

      {tab === "config" &&
        (loading ? (
          <CenterLoader />
        ) : (
          <>
            {error && (
              <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
              No modelo aninhado: o <b>especialista</b> leva uma fatia do total
              da comissão; o <b>escritório</b> leva uma fatia do <b>restante</b>;
              e a <b>plataforma</b> fica automaticamente com o que sobra do
              restante (não é configurada aqui).
            </div>

            <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Escritórios
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Fatia de cada escritório sobre o <b>restante</b> da comissão
                (depois da fatia do especialista). A plataforma fica com o que
                sobrar.
              </p>
              <div className="flex flex-col gap-4">
                {companies.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Nenhum escritório cadastrado.
                  </p>
                ) : (
                  companies.map((company) => {
                    const officeRate = company.commission_rate ?? 0;
                    return (
                      <div
                        key={company.id}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <p className="font-medium text-gray-800 mb-2">
                          {company.name}
                        </p>
                        <RateRow
                          label="Fatia do escritório (% do restante)"
                          initialRate={officeRate}
                          onSave={(rate) => saveCompanyRate(company.id, rate)}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          → Plataforma fica com {Math.max(0, 100 - officeRate)}% do
                          restante
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Especialistas
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Fatia de cada especialista sobre o total da comissão.
              </p>
              <div className="flex flex-col gap-3">
                {specialists.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Nenhum especialista cadastrado.
                  </p>
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
          </>
        ))}

      {tab === "sales" && <SalesCommissionsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-slate-700 text-slate-800"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CenterLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

// ── Aba "Por venda": fluxo de comissão de cada venda fechada ────────────────
function SalesCommissionsTab() {
  const [sales, setSales] = useState<SaleCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSalesCommissions()
      .then(setSales)
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar vendas."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CenterLoader />;
  if (error)
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  if (sales.length === 0)
    return (
      <p className="text-sm text-gray-400 p-4">
        Nenhuma venda fechada ainda.
      </p>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => exportSalesCsv(sales)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
        <button
          type="button"
          onClick={() => exportSalesPdf(sales)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <FileText className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>
      {sales.map((s) => (
        <SaleCard key={s.processId} sale={s} />
      ))}
    </div>
  );
}

function SaleCard({ sale }: { sale: SaleCommission }) {
  const hasOffice = sale.officeValue > 0 || !!sale.officeName;
  // Fatia do especialista sobre o total; escritório/plataforma sobre o restante.
  const specialistShareOfPool =
    sale.totalCommission > 0
      ? (sale.specialistValue / sale.totalCommission) * 100
      : 0;
  const officeShareOfRest =
    sale.restante > 0 ? (sale.officeValue / sale.restante) * 100 : 0;
  const platformShareOfRest =
    sale.restante > 0 ? (sale.platformValue / sale.restante) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="font-semibold text-gray-900">{sale.productLabel}</h3>
        <span className="text-xs text-gray-400">
          Cliente {sale.clientName} · Especialista {sale.specialistName}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Venda: </span>
          <span className="font-semibold text-gray-900">
            {brl(sale.saleValue)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Comissão total: </span>
          <span className="font-semibold text-gray-900">
            {brl(sale.totalCommission)}
          </span>
          <span className="text-gray-400">
            {" "}
            ({sale.totalCommissionRate}% da venda)
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SplitBar
          label="Especialista"
          value={sale.specialistValue}
          share={specialistShareOfPool}
          shareLabel="do total"
          color="bg-emerald-500"
        />

        <div className="pl-3 border-l-2 border-gray-200 ml-1 flex flex-col gap-3">
          <p className="text-xs text-gray-400">
            restante {brl(sale.restante)}
            {!hasOffice && " (sem escritório → 100% plataforma)"}
          </p>
          {hasOffice && (
            <SplitBar
              label={`Escritório${sale.officeName ? ` (${sale.officeName})` : ""}`}
              value={sale.officeValue}
              share={officeShareOfRest}
              shareLabel="do restante"
              color="bg-sky-500"
            />
          )}
          <SplitBar
            label="Plataforma"
            value={sale.platformValue}
            share={platformShareOfRest}
            shareLabel="do restante"
            color="bg-violet-500"
          />
        </div>
      </div>
    </div>
  );
}

function SplitBar({
  label,
  value,
  share,
  shareLabel,
  color,
}: {
  label: string;
  value: number;
  share: number;
  shareLabel: string;
  color: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-56 min-w-[140px] text-sm text-gray-700">{label}</span>
      <div className="flex-1 min-w-[120px] h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
        />
      </div>
      <span className="w-28 text-right text-sm font-medium text-gray-900">
        {brl(value)}
      </span>
      <span className="w-32 text-right text-xs text-gray-400">
        {Math.round(share)}% {shareLabel}
      </span>
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
      <span className="flex-1 min-w-[160px] font-medium text-gray-800">
        {label}
      </span>
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
