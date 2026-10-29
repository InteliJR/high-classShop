import { describe, expect, it } from "vitest";
import { currencySymbol, formatCurrency, parseCurrencyValue } from "./currency";

describe("currency UI", () => {
  it("uses pt-BR symbols without conversion", () => {
    expect(currencySymbol("BRL")).toBe("R$");
    expect(currencySymbol("USD")).toBe("US$");
    expect(formatCurrency(120000, "USD")).toBe("US$ 120.000,00");
  });

  it("formats BRL only when it is explicitly requested", () => {
    expect(formatCurrency(2500, "BRL")).toBe("R$ 2.500,00");
  });

  it.each([
    ["950000.00", 950000],
    ["1000000.00", 1000000],
    ["1500000.00", 1500000],
    ["1500000.50", 1500000.5],
    ["1500000.01", 1500000.01],
    ["950000.01", 950000.01],
    ["0.01", 0.01],
    [".5", 0.5],
    ["1e6", 1000000],
    ["1.5e6", 1500000],
    ["1.50000001e6", 1500000.01],
    ["1e-2", 0.01],
    [1500000.01, 1500000.01],
    [0, 0],
  ])(
    "reads API decimal %s without removing the decimal point",
    (input, expected) => {
      expect(parseCurrencyValue(input)).toBe(expected);
    },
  );

  it.each([
    null,
    undefined,
    "",
    " ",
    "NaN",
    NaN,
    Infinity,
    "Infinity",
    "0x10",
    "1e",
    "1e9999",
    "1 500 000",
    "1.500.000,00",
    "1500000,50",
    "R$ 1.500.000,00",
    true,
    [],
    { d: [1500000], e: 6, s: 1 },
  ])("does not invent a price for invalid input %j", (input) => {
    expect(parseCurrencyValue(input)).toBeNull();
    expect(formatCurrency(input, "BRL")).toBe("Não informado");
  });
});
