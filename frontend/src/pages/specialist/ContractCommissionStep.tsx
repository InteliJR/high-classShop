import { ArrowRight } from "lucide-react";
import type {
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import Button from "../../components/ui/button";
import { formatCurrency, type ProductCurrency } from "../../lib/currency";

/**
 * Etapa 1 do contrato: a comissão, isolada do resto.
 *
 * Fica fora do <form> da etapa 2 de propósito — assim o Enter aqui não dispara
 * o submit do contrato. Os valores continuam no mesmo useForm da página, então
 * o que for digitado aqui chega junto no payload final.
 */
interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  productLabel: string;
  currency: ProductCurrency;
  vehiclePrice: number;
  totalCommissionValue: number;
  sellerNetPreviewValue: number;
  onContinue: () => void;
  onCancel: () => void;
}

export default function ContractCommissionStep({
  register,
  errors,
  productLabel,
  currency,
  vehiclePrice,
  totalCommissionValue,
  sellerNetPreviewValue,
  onContinue,
  onCancel,
}: Props) {
  const commissionError = errors.total_commission_rate as
    | { message?: string }
    | undefined;

  return (
    <div className="space-y-6">
      <section className="bg-surface rounded-lg border border-border p-6">
        <div className="border-b pb-3 mb-5">
          <h2 className="text-base font-semibold text-ink">
            Comissão da venda
          </h2>
          <p className="text-sm text-subtle mt-1">
            Defina a comissão total antes de preencher o restante do contrato.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Valor total do {productLabel}
            </label>
            <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
              {vehiclePrice > 0 ? (
                formatCurrency(vehiclePrice, currency)
              ) : (
                <span className="text-subtle">—</span>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="total_commission_rate"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Comissão total da venda (%) *
            </label>
            <input
              id="total_commission_rate"
              type="number"
              step="0.01"
              autoFocus
              {...register("total_commission_rate", {
                required: "Taxa de comissão é obrigatória",
                valueAsNumber: true,
                min: { value: 0, message: "Valor deve ser positivo" },
                max: { value: 100, message: "Valor deve ser no máximo 100" },
              })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
            />
            <p className="text-xs text-subtle mt-1">
              Único valor editável — as três partes são recalculadas a partir
              deste total e das taxas cadastradas.
            </p>
            {commissionError && (
              <p className="text-status-bad text-sm mt-1">
                {commissionError.message}
              </p>
            )}
          </div>
        </div>

        {/* Consequência do percentual, para a escolha não ser às cegas. */}
        {vehiclePrice > 0 && totalCommissionValue > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t">
            <div>
              <p className="text-xs text-subtle">Comissão total</p>
              <p className="text-sm font-medium text-ink mt-0.5">
                {formatCurrency(totalCommissionValue, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtle">Valor líquido do vendedor</p>
              <p className="text-sm font-medium text-ink mt-0.5">
                {formatCurrency(sellerNetPreviewValue, currency)}
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pb-8">
        <Button
          type="button"
          variant="light"
          onClick={onCancel}
          className="sm:w-auto px-8 py-4"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="flex-1 px-8 py-4 text-base shadow-sm"
        >
          <span className="flex items-center justify-center gap-2">
            Continuar para os dados do contrato
            <ArrowRight className="w-5 h-5" />
          </span>
        </Button>
      </div>
    </div>
  );
}
