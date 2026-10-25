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
