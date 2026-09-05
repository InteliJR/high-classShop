import type { NestedCommissionSplit } from "../../lib/commission-split";
import { effectiveRate } from "../../lib/commission-split";
import { formatCurrency, type ProductCurrency } from "../../lib/currency";

export interface CommissionSplitResultProps {
  saleValue: number;
  split: NestedCommissionSplit;
  currency?: ProductCurrency;
  /** Versão reduzida (card do dashboard): sem tabela, sem linha de bolo. */
  compact?: boolean;
}

const DOT = {
  specialist: "bg-emerald-500",
  office: "bg-sky-500",
  platform: "bg-violet-500",
} as const;

export function CommissionSplitResult({
  saleValue,
  split,
  currency = "BRL",
  compact = false,
}: CommissionSplitResultProps) {
  if (compact) {
    const rows = [
      {
        label: "Especialista",
        value: split.specialistValue,
        dot: DOT.specialist,
      },
      { label: "Escritório", value: split.officeValue, dot: DOT.office },
      {
        label: "Plataforma",
        value: split.platformValue,
        dot: DOT.platform,
      },
    ];
    return (
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
              {row.label}
            </span>
            <span className="font-semibold text-ink">{formatCurrency(row.value, currency)}</span>
          </div>
        ))}
      </div>
    );
  }

  const bodyRows = [
    { label: "Comissão total (bolo)", value: split.bolo, dot: null as string | null },
    { label: "Especialista", value: split.specialistValue, dot: DOT.specialist },
    { label: "Escritório", value: split.officeValue, dot: DOT.office },
  ];

  return (
    <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-border-soft text-ink-soft">
          <th className="text-left px-3 py-2 font-medium">Indicador</th>
          <th className="text-right px-3 py-2 font-medium">Valor</th>
          <th className="text-right px-3 py-2 font-medium">% da venda</th>
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((row) => (
          <tr key={row.label} className="border-t border-border">
            <td className="px-3 py-2 text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                {row.dot && (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                )}
                {row.label}
              </span>
            </td>
            <td className="px-3 py-2 text-right font-medium text-ink">
              {formatCurrency(row.value, currency)}
            </td>
            <td className="px-3 py-2 text-right text-ink-soft">
              {effectiveRate(row.value, saleValue)}%
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-ink text-surface font-bold">
          <td className="px-3 py-2">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT.platform}`} />
              Plataforma
            </span>
          </td>
          <td className="px-3 py-2 text-right">{formatCurrency(split.platformValue, currency)}</td>
          <td className="px-3 py-2 text-right">
            {effectiveRate(split.platformValue, saleValue)}%
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
