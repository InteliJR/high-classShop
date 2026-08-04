import { describe, expect, it } from "vitest";
import { normalizeCommissionCalculatorInput } from "./commission-calculator-input";
import { computeNestedCommissionSplit } from "./commission-split";

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

  it("limita a venda máxima para manter cada etapa do split finita", () => {
    const input = normalizeCommissionCalculatorInput({
      saleValue: String(Number.MAX_VALUE),
      totalCommissionRate: "100",
      specialistShareRate: "50",
      officeShareRate: "100",
    });
    const split = computeNestedCommissionSplit({
      proposalValue: input.saleValue,
      totalCommissionRate: input.totalCommissionRate,
      specialistShareRate: input.specialistShareRate,
      officeShareRate: input.officeShareRate,
    });

    expect(input.saleValue).toBe(Number.MAX_VALUE / 100);
    expect(Object.values(split).every(Number.isFinite)).toBe(true);
  });
});
