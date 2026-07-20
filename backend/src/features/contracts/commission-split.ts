export interface NestedCommissionInput {
  /** Valor de referência da venda (proposta aceita ou preço do produto). */
  proposalValue: number;
  /** % da venda que o especialista define e vira o "bolo" (0–100). */
  totalCommissionRate: number;
  /** Fatia do especialista SOBRE O BOLO (0–100). */
  specialistShareRate: number;
  /** Fatia do escritório SOBRE O RESTANTE (0–100); 0 quando não há escritório. */
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
 *   plataforma   = restante − escritório   (resíduo → soma sempre bate no bolo)
 *
 * A plataforma absorve o resíduo de arredondamento do restante e o restante é
 * derivado de `bolo − especialista`, então especialista + escritório + plataforma
 * = bolo exatamente, sem drift de centavos.
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
