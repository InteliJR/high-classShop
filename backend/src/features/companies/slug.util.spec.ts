import { slugify, generateUniqueSlug } from './slug.util';

describe('slugify', () => {
  it('normaliza acentos, espaços e símbolos', () => {
    expect(slugify('Escritório Alpha & Co')).toBe('escritorio-alpha-co');
  });
  it('colapsa hífens e tira das pontas', () => {
    expect(slugify('  --Náutica  Premium--  ')).toBe('nautica-premium');
  });
  it('string sem alfanumérico vira fallback estável', () => {
    expect(slugify('###')).toBe('escritorio');
  });
});

describe('generateUniqueSlug', () => {
  it('retorna o slug base quando livre', async () => {
    const slug = await generateUniqueSlug('Alpha Co', async () => false);
    expect(slug).toBe('alpha-co');
  });
  it('sufixa incrementalmente quando há colisão', async () => {
    const taken = new Set(['alpha-co', 'alpha-co-2']);
    const slug = await generateUniqueSlug('Alpha Co', async (s) => taken.has(s));
    expect(slug).toBe('alpha-co-3');
  });
});
