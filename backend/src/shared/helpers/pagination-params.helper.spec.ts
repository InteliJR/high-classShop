import { parsePaginationParams } from './pagination-params.helper';

describe('parsePaginationParams', () => {
  it('converte a query e mantém valores válidos', () => {
    expect(parsePaginationParams('3', '20')).toEqual({ page: 3, perPage: 20 });
  });

  it('usa página 1 e 20 itens quando ausente ou inválido', () => {
    expect(parsePaginationParams(undefined, undefined)).toEqual({
      page: 1,
      perPage: 20,
    });
    expect(parsePaginationParams('-1', '0')).toEqual({ page: 1, perPage: 20 });
    expect(parsePaginationParams('2.5', 'abc')).toEqual({
      page: 1,
      perPage: 20,
    });
  });

  it('limita perPage a 100', () => {
    expect(parsePaginationParams('1', '100000')).toEqual({
      page: 1,
      perPage: 100,
    });
  });
});
