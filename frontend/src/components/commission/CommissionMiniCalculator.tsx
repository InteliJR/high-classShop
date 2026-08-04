import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { CommissionSplitResult } from "./CommissionSplitResult";
import { computeNestedCommissionSplit } from "../../lib/commission-split";
import { normalizeCommissionCalculatorInput } from "../../lib/commission-calculator-input";
import {
  getSpecialists,
  type Specialist,
} from "../../services/specialists.service";

export function CommissionMiniCalculator() {
  const [saleValue, setSaleValue] = useState("0");
  const [totalCommissionRate, setTotalCommissionRate] = useState("10");
  const [specialistShareRate, setSpecialistShareRate] = useState("0");
  const [specialists, setSpecialists] = useState<Specialist[]>([]);

  useEffect(() => {
    getSpecialists().then(setSpecialists).catch(() => setSpecialists([]));
  }, []);

  const calculationInput = useMemo(
    () =>
      normalizeCommissionCalculatorInput({
        saleValue,
        totalCommissionRate,
        specialistShareRate,
        officeShareRate: "0",
      }),
    [saleValue, totalCommissionRate, specialistShareRate],
  );

  const split = useMemo(
    () =>
      computeNestedCommissionSplit({
        proposalValue: calculationInput.saleValue,
        totalCommissionRate: calculationInput.totalCommissionRate,
        specialistShareRate: calculationInput.specialistShareRate,
        officeShareRate: calculationInput.officeShareRate,
      }),
    [calculationInput],
  );

  return (
    <Card className="h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-ink-soft" />
          <h2 className="text-lg font-semibold text-ink">Calculadora rápida</h2>
        </div>
        <Link
          to="/admin/calculator"
          className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink shrink-0 whitespace-nowrap"
        >
          calculadora completa <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor="mini-calculator-sale-value" className="block text-xs text-muted mb-1">
            Valor de venda (R$)
          </label>
          <Input
            id="mini-calculator-sale-value"
            type="number"
            min={0}
            step="0.01"
            value={saleValue}
            onChange={(e) => setSaleValue(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="mini-calculator-total-commission-rate"
            className="block text-xs text-muted mb-1"
          >
            Comissão total (%)
          </label>
          <Input
            id="mini-calculator-total-commission-rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={totalCommissionRate}
            onChange={(e) => setTotalCommissionRate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="mini-calculator-specialist" className="block text-xs text-muted mb-1">
            Especialista
          </label>
          <select
            id="mini-calculator-specialist"
            onChange={(e) => {
              const specialist = specialists.find((s) => s.id === e.target.value);
              setSpecialistShareRate(String(specialist?.commission_rate ?? 0));
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="">Nenhum</option>
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.surname}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <CommissionSplitResult
          saleValue={calculationInput.saleValue}
          split={split}
          compact
        />
      </div>
    </Card>
  );
}
