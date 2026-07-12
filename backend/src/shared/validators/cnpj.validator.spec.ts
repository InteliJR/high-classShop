import { IsValidCNPJConstraint } from './cnpj.validator';

describe('IsValidCNPJConstraint', () => {
  const validator = new IsValidCNPJConstraint();

  it('accepts valid CNPJs (with and without mask)', () => {
    expect(validator.validate('60701190000104')).toBe(true); // Itaú Unibanco
    expect(validator.validate('11.222.333/0001-81')).toBe(true);
  });

  it('rejects invalid CNPJs', () => {
    expect(validator.validate('')).toBe(false);
    expect(validator.validate('11111111111111')).toBe(false); // all same digit
    expect(validator.validate('1234567890123')).toBe(false); // wrong length
    expect(validator.validate('60701190000105')).toBe(false); // wrong check digit
  });
});
