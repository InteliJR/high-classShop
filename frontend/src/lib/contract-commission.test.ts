import { describe, expect, it } from "vitest";
import { getCommissionPreview } from "./contract-commission";

describe("getCommissionPreview", () => {
  it("mostra o total da venda e o repasse do especialista pelo split", () => {
    const preview = getCommissionPreview({
      saleValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
    });

    expect(preview.totalCommissionValue).toBe(10_000);
    expect(preview.specialistValue).toBe(7_000);
  });

  it("mantém os valores em zero até que a porcentagem seja definida", () => {
    expect(
      getCommissionPreview({
        saleValue: 100_000,
        totalCommissionRate: 0,
        specialistShareRate: 70,
      }),
    ).toEqual({ totalCommissionValue: 0, specialistValue: 0 });
  });

  it("não exibe um valor inválido enquanto a porcentagem está vazia", () => {
    expect(
      getCommissionPreview({
        saleValue: 100_000,
        totalCommissionRate: Number.NaN,
        specialistShareRate: 70,
      }),
    ).toEqual({ totalCommissionValue: 0, specialistValue: 0 });
  });
});
