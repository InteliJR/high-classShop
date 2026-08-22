export interface NestedCommissionInput {
  /** Valor de referência da venda (proposta aceita ou preço do produto). */
  proposalValue: number;
  /** % da venda que o especialista define e vira o "bolo" (0–100). */
  totalCommissionRate: number;
  /** Fatia do especialista SOBRE O BOLO (0–100). */
  specialistShareRate: number;
  /** Fatia do escritório SOBRE A COMISSÃO TOTAL (0–100); 0 quando não há escritório. */
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
 * Split da comissão total:
 *   bolo         = venda × total%
 *   especialista = bolo × fatiaEspecialista%
 *   escritório   = bolo × fatiaEscritório%
 *   plataforma   = bolo − especialista − escritório (resíduo → soma sempre bate no bolo)
 *
 * A plataforma absorve o resíduo de arredondamento. Quem chama esta função deve
 * garantir que as fatias de especialista e escritório não ultrapassem 100%.
 */
export function computeNestedCommissionSplit(
  input: NestedCommissionInput,
): NestedCommissionSplit {
  const bolo = round2((input.proposalValue * input.totalCommissionRate) / 100);
  const specialistValue = round2((bolo * input.specialistShareRate) / 100);
  const officeValue = round2((bolo * input.officeShareRate) / 100);
  const platformValue = round2(bolo - specialistValue - officeValue);
  return { bolo, specialistValue, officeValue, platformValue };
}
