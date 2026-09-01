import { describe, expect, it } from "vitest";
import { currencySymbol, formatCurrency } from "./currency";

describe("currency UI", () => {
  it("uses pt-BR symbols without conversion", () => {
    expect(currencySymbol("BRL")).toBe("R$");
    expect(currencySymbol("USD")).toBe("US$");
    expect(formatCurrency(120000, "USD")).toBe("US$ 120.000,00");
  });

  it("formats BRL only when it is explicitly requested", () => {
    expect(formatCurrency(2500, "BRL")).toBe("R$ 2.500,00");
  });
});
