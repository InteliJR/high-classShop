// ponytail: cópia da lógica pura de backend/src/features/contracts/commission-split.ts
// (fonte de verdade do split real do contrato) — manter em sync manualmente se aquele
// arquivo mudar; sem endpoint novo, calculadora roda 100% no client.

export interface NestedCommissionInput {
  /** Valor de referência da venda (produto ou manual). */
  proposalValue: number;
  /** % da venda que vira o "bolo" (comissão total), 0–100. */
  totalCommissionRate: number;
  /** Fatia do especialista SOBRE O BOLO, 0–100. */
  specialistShareRate: number;
  /** Fatia do escritório SOBRE O RESTANTE, 0–100; 0 quando não há escritório. */
  officeShareRate: number;
}

export interface NestedCommissionSplit {
  bolo: number;
  specialistValue: number;
  officeValue: number;
  platformValue: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Split aninhado da comissão:
 *   bolo         = venda × total%
 *   especialista = bolo × fatiaEspecialista%
 *   restante     = bolo − especialista
 *   escritório   = restante × fatiaEscritório%
 *   plataforma   = restante − escritório   (resíduo)
 */
export function computeNestedCommissionSplit(
  input: NestedCommissionInput,
): NestedCommissionSplit {
  const bolo = round2((input.proposalValue * input.totalCommissionRate) / 100);
  const specialistValue = round2((bolo * input.specialistShareRate) / 100);
  const restante = round2(bolo - specialistValue);
  const officeValue = round2((restante * input.officeShareRate) / 100);
  const platformValue = round2(restante - officeValue);
  return { bolo, specialistValue, officeValue, platformValue };
}

/** Taxa efetiva de um valor sobre a venda, em %. */
export function effectiveRate(value: number, saleValue: number): number {
  return saleValue > 0 ? round2((value / saleValue) * 100) : 0;
}
