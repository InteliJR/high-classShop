import { describe, expect, it } from "vitest";
import { getCommissionPreview } from "./contract-commission";
import { formatCurrency } from "./currency";

describe("getCommissionPreview", () => {
  it("mostra o total da venda e o repasse do especialista pelo split", () => {
    const preview = getCommissionPreview({
      saleValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 20,
    });

    expect(preview.totalCommissionValue).toBe(10_000);
    expect(preview.specialistValue).toBe(7_000);
    expect(preview.officeValue).toBe(2_000);
    expect(preview.platformValue).toBe(1_000);
  });

  it("apresenta as três parcelas em USD sem converter os valores", () => {
    const preview = getCommissionPreview({
      saleValue: 1_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 20,
    });

    expect(formatCurrency(preview.platformValue, "USD")).toBe("US$ 10,00");
    expect(formatCurrency(preview.officeValue, "USD")).toBe("US$ 20,00");
    expect(formatCurrency(preview.specialistValue, "USD")).toBe(
      "US$ 70,00",
    );
  });

  it("apresenta as três parcelas em BRL com rounding do split compartilhado", () => {
    const preview = getCommissionPreview({
      saleValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 20,
    });

    expect(formatCurrency(preview.platformValue, "BRL")).toBe("R$ 1.000,00");
    expect(formatCurrency(preview.officeValue, "BRL")).toBe("R$ 2.000,00");
    expect(formatCurrency(preview.specialistValue, "BRL")).toBe(
      "R$ 7.000,00",
    );
    expect(
      preview.platformValue + preview.officeValue + preview.specialistValue,
    ).toBe(preview.totalCommissionValue);
  });

  it("mantém os valores em zero até que a porcentagem seja definida", () => {
    expect(
      getCommissionPreview({
        saleValue: 100_000,
        totalCommissionRate: 0,
        specialistShareRate: 70,
        officeShareRate: 20,
      }),
    ).toEqual({
      totalCommissionValue: 0,
      platformValue: 0,
      officeValue: 0,
      specialistValue: 0,
    });
  });

  it("não exibe um valor inválido enquanto a porcentagem está vazia", () => {
    expect(
      getCommissionPreview({
        saleValue: 100_000,
        totalCommissionRate: Number.NaN,
        specialistShareRate: 70,
        officeShareRate: 20,
      }),
    ).toEqual({
      totalCommissionValue: 0,
      platformValue: 0,
      officeValue: 0,
      specialistValue: 0,
    });
  });
});
