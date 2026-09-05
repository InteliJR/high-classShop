import { ProductCurrency } from '@prisma/client';
import { formatBRL, formatCurrency, formatRg } from './format.utils';

describe('formatRg', () => {
  it('formata RG de 7, 8 ou 9 dígitos', () => {
    expect(formatRg('1234567')).toBe('1.234.567');
    expect(formatRg('12345678')).toBe('12.345.678');
    expect(formatRg('123456789')).toBe('12.345.678-9');
  });

  it('formata como CPF quando tiver 11 dígitos (unificação RG/CPF)', () => {
    expect(formatRg('12345678900')).toBe('123.456.789-00');
  });

  it('devolve o valor original para tamanhos inválidos', () => {
    expect(formatRg('123')).toBe('123');
  });
});

describe('formatCurrency', () => {
  it.each([
    [ProductCurrency.BRL, 'R$ 120.000,00'],
    [ProductCurrency.USD, 'US$ 120.000,00'],
  ])('formats %s in pt-BR without conversion', (currency, expected) => {
    expect(formatCurrency(120000, currency).replace(/\u00a0/g, ' ')).toBe(
      expected,
    );
  });

  it('keeps formatBRL as a compatible BRL wrapper', () => {
    expect(formatBRL(120000)).toBe(formatCurrency(120000, ProductCurrency.BRL));
  });
});
