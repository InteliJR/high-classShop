/**
 * Filtros de faixa das listagens de produtos (carros, lanchas e aeronaves).
 *
 * Os valores chegam da query string como texto (`@Query() query: any` não
 * passa por DTO, então o ValidationPipe não converte nada). O Prisma rejeita
 * texto em colunas Int/Decimal, por isso a conversão acontece aqui.
 */

/**
 * Converte um valor de query em número finito. Vazio, não numérico ou repetido
 * (`?ano_min=1&ano_min=2` chega como array) vira `undefined` e o filtro é
 * ignorado, em vez de derrubar a listagem com erro do Prisma.
 */
export function toFilterNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

// Colunas Int do Postgres não aceitam decimal nem valor fora do int32: o
// Prisma rejeitaria a query inteira, então o limite é ignorado.
function toIntFilterNumber(value: unknown): number | undefined {
  const parsed = toFilterNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed)) return undefined;
  return parsed >= INT32_MIN && parsed <= INT32_MAX ? parsed : undefined;
}

/**
 * Monta `{ gte: min, lte: max }` para o Prisma; `undefined` quando nenhum
 * limite válido foi informado. `integer` para colunas Int (ano, km, assentos).
 */
export function buildRangeCondition(
  min: unknown,
  max: unknown,
  integer = false,
): { gte?: number; lte?: number } | undefined {
  const parse = integer ? toIntFilterNumber : toFilterNumber;
  const gte = parse(min);
  const lte = parse(max);
  if (gte === undefined && lte === undefined) return undefined;
  return {
    ...(gte !== undefined ? { gte } : {}),
    ...(lte !== undefined ? { lte } : {}),
  };
}

/** Aplica cada faixa válida em `where[campo]`. */
export function applyRangeFilters(
  where: Record<string, unknown>,
  ranges: Record<string, { min: unknown; max: unknown; integer?: boolean }>,
): void {
  for (const [field, { min, max, integer }] of Object.entries(ranges)) {
    const condition = buildRangeCondition(min, max, integer);
    if (condition) where[field] = condition;
  }
}
