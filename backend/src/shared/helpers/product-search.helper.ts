export const PRODUCT_SEARCH_MAX_LENGTH = 100;

/**
 * Monta as condições de busca textual das listagens de produtos (carros,
 * lanchas e aeronaves): `marca`/`modelo`/`estado` por `contains` sem diferenciar
 * maiúsculas e, quando o termo for um número de 4 dígitos, `ano` exato.
 *
 * Retorna `undefined` quando não há termo útil (ausente, vazio, só espaços
 * ou não-string — ex.: `?search=a&search=b` chega como array).
 */
export function buildProductSearchConditions(
  search: unknown,
): Record<string, unknown>[] | undefined {
  if (typeof search !== 'string') return undefined;
  const term = search.trim().slice(0, PRODUCT_SEARCH_MAX_LENGTH).trim();
  if (!term) return undefined;

  const conditions: Record<string, unknown>[] = [
    { marca: { contains: term, mode: 'insensitive' } },
    { modelo: { contains: term, mode: 'insensitive' } },
    { estado: { contains: term, mode: 'insensitive' } },
  ];
  if (/^\d{4}$/.test(term)) {
    conditions.push({ ano: Number(term) });
  }
  return conditions;
}
