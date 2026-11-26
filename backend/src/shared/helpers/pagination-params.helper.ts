export const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 20;

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

/**
 * Normaliza `page`/`perPage` vindos da query: página inteira >= 1 e até
 * MAX_PER_PAGE itens por página.
 * Evita `skip` negativo (erro do Prisma) e páginas gigantes, que assinariam
 * uma URL do S3 por imagem de cada produto numa só requisição.
 */
export function parsePaginationParams(
  page: unknown,
  perPage: unknown,
): { page: number; perPage: number } {
  return {
    page: toPositiveInt(page) ?? 1,
    perPage: Math.min(toPositiveInt(perPage) ?? DEFAULT_PER_PAGE, MAX_PER_PAGE),
  };
}
