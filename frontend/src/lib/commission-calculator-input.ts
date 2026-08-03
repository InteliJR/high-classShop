export interface CommissionCalculatorTextInput {
  saleValue: string;
  totalCommissionRate: string;
  specialistShareRate: string;
  officeShareRate: string;
}

export interface NormalizedCommissionCalculatorInput {
  saleValue: number;
  totalCommissionRate: number;
  specialistShareRate: number;
  officeShareRate: number;
}

const finiteNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inRange = (value: string, min: number, max: number): number =>
  Math.min(max, Math.max(min, finiteNumber(value)));

/**
 * Converte somente para o cálculo. Os campos continuam controlados pelo texto
 * digitado, inclusive enquanto o usuário está no meio de uma edição decimal.
 */
export function normalizeCommissionCalculatorInput(
  input: CommissionCalculatorTextInput,
): NormalizedCommissionCalculatorInput {
  return {
    saleValue: inRange(input.saleValue, 0, Number.MAX_VALUE),
    totalCommissionRate: inRange(input.totalCommissionRate, 0, 100),
    specialistShareRate: inRange(input.specialistShareRate, 0, 100),
    officeShareRate: inRange(input.officeShareRate, 0, 100),
  };
}
