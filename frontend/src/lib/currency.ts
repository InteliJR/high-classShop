export const PRODUCT_CURRENCIES = ["BRL", "USD"] as const;

export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];

/** Formats a product amount in its source currency; it never converts values. */
export function formatCurrency(
  value: number,
  currency: ProductCurrency,
): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export function currencySymbol(currency: ProductCurrency): "R$" | "US$" {
  return currency === "USD" ? "US$" : "R$";
}
