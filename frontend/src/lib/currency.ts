export const PRODUCT_CURRENCIES = ["BRL", "USD"] as const;

export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];

/** Reads base-10 API values and numeric inputs, including decimal exponents. */
export function parseCurrencyValue(value: unknown): number | null {
  if (typeof value === "string") {
    const decimal = value.trim();
    if (!/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(decimal)) return null;
    value = Number(decimal);
  }
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Formats a product amount in its source currency; it never converts values. */
export function formatCurrency(
  value: unknown,
  currency: ProductCurrency,
): string {
  const amount = parseCurrencyValue(value);
  if (amount === null) return "Não informado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amount);
}

export function currencySymbol(currency: ProductCurrency): "R$" | "US$" {
  return currency === "USD" ? "US$" : "R$";
}
