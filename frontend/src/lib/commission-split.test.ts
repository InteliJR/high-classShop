import { describe, it, expect } from "vitest";
import { computeNestedCommissionSplit, effectiveRate } from "./commission-split";

describe("computeNestedCommissionSplit", () => {
  it("divide bolo em especialista / escritório / plataforma (aninhado)", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10, // bolo = 10.000
      specialistShareRate: 70, // 70% do bolo
      officeShareRate: 40, // 40% do restante
    });
    expect(r.bolo).toBe(10_000);
    expect(r.specialistValue).toBe(7_000);
    expect(r.officeValue).toBe(1_200); // 40% de 3.000
    expect(r.platformValue).toBe(1_800); // resto do restante
  });

  it("sem escritório: restante inteiro vai pra plataforma", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 0,
    });
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(3_000);
  });

  it("as três fatias somam exatamente o bolo (sem drift de centavos)", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 99_999.99,
      totalCommissionRate: 7.33,
      specialistShareRate: 63.5,
      officeShareRate: 41.7,
    });
    expect(r.specialistValue + r.officeValue + r.platformValue).toBe(r.bolo);
  });

  it("especialista com 100% do bolo zera escritório e plataforma", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 50_000,
      totalCommissionRate: 8,
      specialistShareRate: 100,
      officeShareRate: 50,
    });
    expect(r.specialistValue).toBe(r.bolo);
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(0);
  });
});

describe("effectiveRate", () => {
  it("calcula a taxa efetiva sobre a venda", () => {
    expect(effectiveRate(7_000, 100_000)).toBe(7);
    expect(effectiveRate(1_200, 100_000)).toBe(1.2);
  });

  it("retorna 0 quando a venda é 0", () => {
    expect(effectiveRate(100, 0)).toBe(0);
  });
});
