// Página consolidada de comissões (ADMIN). Duas abas:
//  - "Configurar taxas": edição das fatias (plataforma, escritórios, especialistas).
//  - "Por venda": fluxo de comissão de cada venda fechada (quanto vai para cada parte).

import { useEffect, useState, type ReactNode } from "react";
import {
  Percent,
  Save,
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
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";

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
        <Percent className="w-7 h-7 text-ink-soft" />
        <div>
          <h1 className="text-h1 font-bold text-ink">Comissões</h1>
          <p className="text-sm text-muted">
            Comissão de cada especialista, escritório e da plataforma — e o fluxo
            de cada venda.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-6">
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
              <Alert variant="danger" className="mb-6">
                {error}
              </Alert>
            )}

            <Alert variant="info" className="mb-6">
              No modelo aninhado: o <b>especialista</b> leva uma fatia do total
              da comissão; o <b>escritório</b> leva uma fatia do <b>restante</b>;
              e a <b>plataforma</b> fica automaticamente com o que sobra do
              restante (não é configurada aqui).
            </Alert>

            <Card className="mb-6">
              <h2 className="text-lg font-semibold text-ink mb-1">
                Escritórios
              </h2>
              <p className="text-sm text-muted mb-4">
                Fatia de cada escritório sobre o <b>restante</b> da comissão
                (depois da fatia do especialista). A plataforma fica com o que
                sobrar.
              </p>
              <div className="flex flex-col gap-4">
                {companies.length === 0 ? (
                  <p className="text-sm text-subtle">
                    Nenhum escritório cadastrado.
                  </p>
                ) : (
                  companies.map((company) => {
                    const officeRate = company.commission_rate ?? 0;
                    return (
                      <div
                        key={company.id}
                        className="border border-border rounded-lg p-3"
                      >
                        <p className="font-medium text-ink-soft mb-2">
                          {company.name}
                        </p>
                        <RateRow
                          label="Fatia do escritório (% do restante)"
                          initialRate={officeRate}
                          onSave={(rate) => saveCompanyRate(company.id, rate)}
                        />
                        <p className="text-xs text-subtle mt-2">
                          → Plataforma fica com {Math.max(0, 100 - officeRate)}% do
                          restante
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-ink mb-1">
                Especialistas
              </h2>
              <p className="text-sm text-muted mb-4">
                Fatia de cada especialista sobre o total da comissão.
              </p>
              <div className="flex flex-col gap-3">
                {specialists.length === 0 ? (
                  <p className="text-sm text-subtle">
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
            </Card>
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
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink-soft"
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
      <Loader className="w-8 h-8 animate-spin text-subtle" />
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
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (sales.length === 0)
    return (
      <p className="text-sm text-subtle p-4">
        Nenhuma venda fechada ainda.
      </p>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="light" onClick={() => exportSalesCsv(sales)}>
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
        <Button type="button" variant="light" onClick={() => exportSalesPdf(sales)}>
          <FileText className="w-4 h-4" />
          Exportar PDF
        </Button>
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
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="font-semibold text-ink">{sale.productLabel}</h3>
        <span className="text-xs text-subtle">
          Cliente {sale.clientName} · Especialista {sale.specialistName}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1 mb-4 text-sm">
        <div>
          <span className="text-muted">Venda: </span>
          <span className="font-semibold text-ink">
            {brl(sale.saleValue)}
          </span>
        </div>
        <div>
          <span className="text-muted">Comissão total: </span>
          <span className="font-semibold text-ink">
            {brl(sale.totalCommission)}
          </span>
          <span className="text-subtle">
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

        <div className="pl-3 border-l-2 border-border ml-1 flex flex-col gap-3">
          <p className="text-xs text-subtle">
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
    </Card>
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
      <span className="w-56 min-w-[140px] text-sm text-ink-soft">{label}</span>
      <div className="flex-1 min-w-[120px] h-2.5 bg-border-soft rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
        />
      </div>
      <span className="w-28 text-right text-sm font-medium text-ink">
        {brl(value)}
      </span>
      <span className="w-32 text-right text-xs text-subtle">
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
    <div className="flex flex-wrap items-center gap-3 bg-border-soft border border-border rounded-lg px-4 py-3">
      <span className="flex-1 min-w-[160px] font-medium text-ink-soft">
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
          className="w-24 px-2 py-1 border border-border rounded-md text-right"
        />
        <span className="text-muted text-sm">%</span>
      </div>
      <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
        {saving ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar
      </Button>
      {status === "saved" && (
        <Check className="w-4 h-4 text-status-ok" aria-label="Salvo" />
      )}
      {status === "error" && (
        <span className="text-xs text-status-bad">Erro ao salvar</span>
      )}
    </div>
  );
}
