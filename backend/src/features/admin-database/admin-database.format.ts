// Formatadores puros para o navegador de base de dados do admin.
// Regra geral: nunca lançam. Valor inesperado cai no fallback (valor cru),
// porque uma célula feia é melhor que uma página de 500.

/** Placeholder de valor ausente. Travessão (U+2014), nunca vazio nem "null". */
export const EMPTY = '—';

/** true quando o valor deve virar EMPTY sem passar pelo formatador. */
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** Envolve um formatador com o guarda de vazio + o fallback de erro. */
function safe(fn: (v: unknown) => string): (v: unknown) => string {
  return (v: unknown) => {
    if (isEmpty(v)) return EMPTY;
    try {
      return fn(v);
    } catch {
      return String(v);
    }
  };
}

const onlyDigits = (v: unknown) => String(v).replace(/\D/g, '');

/** Coage Decimal do Prisma (decimal.js), string ou number para number. NaN se não der. */
function toNumber(v: unknown): number {
  return Number(String(v));
}

export const text = safe((v) => String(v));

export const cpf = safe((v) => {
  const d = onlyDigits(v);
  if (d.length !== 11) return String(v);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
});

export const cnpj = safe((v) => {
  const d = onlyDigits(v);
  if (d.length !== 14) return String(v);
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
});

/** User.cpf é polimórfica: CPF para a maioria dos papéis, CNPJ para SPECIALIST. */
export const document = safe((v) =>
  onlyDigits(v).length > 11 ? cnpj(v) : cpf(v),
);

export const phone = safe((v) => {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return String(v);
});

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const money = safe((v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return String(v);
  // Intl usa NBSP (ou, em builds de ICU mais recentes, o narrow no-break
  // space U+202F) entre símbolo e número; normalizamos para espaço comum
  // para não quebrar comparações e o strip de "R$ " no CSV do frontend.
  return BRL.format(n).replace(/[\u00A0\u202F]/g, ' ');
});

const DECIMAL2 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const rate = safe((v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return String(v);
  return `${DECIMAL2.format(n)}%`;
});

const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const int = safe((v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return String(v);
  return INTEGER.format(n);
});

const TZ = 'America/Sao_Paulo';

function toDate(v: unknown): Date | null {
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const date = safe((v) => {
  const d = toDate(v);
  if (!d) return String(v);
  return d.toLocaleDateString('pt-BR', { timeZone: TZ });
});

export const datetime = safe((v) => {
  const d = toDate(v);
  if (!d) return String(v);
  return `${d.toLocaleDateString('pt-BR', { timeZone: TZ })} ${d.toLocaleTimeString(
    'pt-BR',
    { timeZone: TZ, hour: '2-digit', minute: '2-digit' },
  )}`;
});

export const bool = safe((v) => (v ? 'Sim' : 'Não'));

/** Company.color_identity: array de hex vira texto simples, copiável. */
export const hexList = safe((v) => {
  const list = Array.isArray(v) ? v : [v];
  return list.length ? list.join(', ') : EMPTY;
});
