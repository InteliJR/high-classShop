import { computeNestedCommissionSplit } from './commission-split';

describe('computeNestedCommissionSplit', () => {
  it('calcula as fatias de especialista e escritório sobre a comissão total', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10, // bolo = 10.000
      specialistShareRate: 70, // 70% do bolo
      officeShareRate: 20, // 20% do bolo
    });
    expect(r.bolo).toBe(10_000);
    expect(r.specialistValue).toBe(7_000);
    expect(r.officeValue).toBe(2_000); // 20% de 10.000
    expect(r.platformValue).toBe(1_000); // saldo do bolo
  });

  it('sem escritório: o saldo inteiro vai pra plataforma', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 0,
    });
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(3_000);
  });

  it('as três fatias somam exatamente o bolo (sem drift de centavos)', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 99_999.99,
      totalCommissionRate: 7.33,
      specialistShareRate: 63.5,
      officeShareRate: 31.7,
    });
    expect(r.specialistValue + r.officeValue + r.platformValue).toBe(r.bolo);
  });

  it('especialista com 100% do bolo zera escritório e plataforma', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 50_000,
      totalCommissionRate: 8,
      specialistShareRate: 100,
      officeShareRate: 0,
    });
    expect(r.specialistValue).toBe(r.bolo);
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(0);
  });

  it('taxa efetiva sobre a venda = valor / venda × 100', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 20,
    });
    const effective = (v: number) => Math.round((v / 100_000) * 100 * 100) / 100;
    expect(effective(r.specialistValue)).toBe(7); // 7% da venda
    expect(effective(r.officeValue)).toBe(2);
    expect(effective(r.platformValue)).toBe(1);
  });
});
