import { isCommissionConfigured } from "../../lib/commission-rate";

export default function CommissionConfigurationBadge({
  rate,
}: {
  rate?: number | null;
}) {
  if (isCommissionConfigured(rate)) return null;

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Comissão não configurada
    </span>
  );
}
