import { describe, expect, it } from "vitest";
import { normalizeCommissionCalculatorInput } from "./commission-calculator-input";

describe("normalizeCommissionCalculatorInput", () => {
  it("normaliza valores fora do domínio antes de calcular o split", () => {
    expect(
      normalizeCommissionCalculatorInput({
        saleValue: "-250",
        totalCommissionRate: "101",
        specialistShareRate: "-1",
        officeShareRate: "250",
      }),
    ).toEqual({
      saleValue: 0,
      totalCommissionRate: 100,
      specialistShareRate: 0,
      officeShareRate: 100,
    });
  });

  it("descarta entradas não finitas sem alterar o texto que o campo controla", () => {
    expect(
      normalizeCommissionCalculatorInput({
        saleValue: "Infinity",
        totalCommissionRate: "NaN",
        specialistShareRate: "",
        officeShareRate: "1e309",
      }),
    ).toEqual({
      saleValue: 0,
      totalCommissionRate: 0,
      specialistShareRate: 0,
      officeShareRate: 0,
    });
  });
});
