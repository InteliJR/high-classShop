import {
  applyRangeFilters,
  buildRangeCondition,
  toFilterNumber,
} from './product-range.helper';

describe('product-range.helper', () => {
  it('converte texto numérico da query em número', () => {
    expect(toFilterNumber('2020')).toBe(2020);
    expect(toFilterNumber(' 1500000.5 ')).toBe(1500000.5);
    expect(toFilterNumber(42)).toBe(42);
  });

  it('descarta vazio, não numérico, infinito e valores repetidos', () => {
    expect(toFilterNumber('')).toBeUndefined();
    expect(toFilterNumber('   ')).toBeUndefined();
    expect(toFilterNumber('abc')).toBeUndefined();
    expect(toFilterNumber('Infinity')).toBeUndefined();
    expect(toFilterNumber(Number.NaN)).toBeUndefined();
    expect(toFilterNumber(['1', '2'])).toBeUndefined();
    expect(toFilterNumber(undefined)).toBeUndefined();
    expect(toFilterNumber(null)).toBeUndefined();
  });

  it('monta gte a partir do mínimo e lte a partir do máximo', () => {
    expect(buildRangeCondition('2018', '2022')).toEqual({
      gte: 2018,
      lte: 2022,
    });
    expect(buildRangeCondition('2018', undefined)).toEqual({ gte: 2018 });
    expect(buildRangeCondition(undefined, '2022')).toEqual({ lte: 2022 });
    expect(buildRangeCondition('', 'x')).toBeUndefined();
  });

  it('aplica só as faixas com algum limite válido', () => {
    const where: Record<string, unknown> = { is_active: true };
    applyRangeFilters(where, {
      ano: { min: '2018', max: undefined },
      valor: { min: '', max: '' },
    });
    expect(where).toEqual({ is_active: true, ano: { gte: 2018 } });
  });
});

describe('product-range.helper — colunas Int', () => {
  it('ignora decimal e valor fora do int32 quando a coluna é Int', () => {
    expect(buildRangeCondition('2020.5', '2022', true)).toEqual({ lte: 2022 });
    expect(buildRangeCondition('1e12', undefined, true)).toBeUndefined();
    expect(buildRangeCondition('2147483647', undefined, true)).toEqual({
      gte: 2147483647,
    });
  });

  it('mantém decimais para colunas Decimal (valor)', () => {
    expect(buildRangeCondition('1500000.50', undefined)).toEqual({
      gte: 1500000.5,
    });
  });
});
