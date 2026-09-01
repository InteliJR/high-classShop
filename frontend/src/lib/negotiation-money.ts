import { formatCurrency, type ProductCurrency } from "./currency";

type MinimumSource = {
  currency: ProductCurrency;
  minimum_enabled: boolean;
  minimum_value: number | null;
};

export function getMinimumPresentation(source: MinimumSource): {
  visible: boolean;
  formattedValue: string | null;
} {
  if (!source.minimum_enabled || source.minimum_value === null) {
    return { visible: false, formattedValue: null };
  }

  return {
    visible: true,
    formattedValue: formatCurrency(source.minimum_value, source.currency),
  };
}

export function normalizeMinimumFormError(
  error: string | null,
  source: MinimumSource,
): string | null {
  if (
    error === null ||
    getMinimumPresentation(source).visible ||
    !error.startsWith("O valor mínimo permitido é ")
  ) {
    return error;
  }

  return null;
}
