import { getConsultancyReason } from './consultancy-reason';

describe('consultancy reason projection', () => {
  it('keeps the original reason when a process later receives a product', () => {
    expect(
      getConsultancyReason({
        product_type: null,
        product_id: null,
        notes: '  Preciso de orientação para escolher um carro.  ',
      }),
    ).toBe('Preciso de orientação para escolher um carro.');
  });

  it.each([
    'Consultoria solicitada pelo cliente',
    'Cliente solicitou reunião por e-mail',
    'Cliente acessou link do Calendly',
    'Consultoria criada pelo consultor em nome do cliente (2026-10-25T12:00:00.000Z)',
    'Consultoria criada pelo gerente do escritório em nome do cliente (2026-10-25T12:00:00.000Z)',
  ])(
    'does not present the automatic note as a customer reason: %s',
    (notes) => {
      for (const value of [notes, ` \n${notes}\t `]) {
        expect(
          getConsultancyReason({
            product_type: null,
            product_id: null,
            notes: value,
          }),
        ).toBeNull();
      }
    },
  );

  it.each([
    'Consultoria solicitada pelo cliente: quero comparar carros para viagens.',
    'Cliente acessou link do Calendly, mas preciso de orientação para escolher um barco.',
    'Consultoria criada pelo consultor em nome do cliente (2026-10-25T12:00:00.000Z)\nQuero avaliar opções para minha família.',
  ])(
    'keeps actual customer text that only resembles an automatic note: %s',
    (notes) => {
      expect(
        getConsultancyReason({ product_type: null, product_id: null, notes }),
      ).toBe(notes);
    },
  );

  it.each([
    undefined,
    null,
    {},
    { product_type: null, product_id: null },
    { product_type: null, product_id: null, notes: ' \n ' },
    { product_type: 'CAR', product_id: 'car-1', notes: 'Nota de produto' },
  ])(
    'does not invent a reason for absent legacy data or product appointments: %p',
    (appointment) => expect(getConsultancyReason(appointment)).toBeNull(),
  );
});
