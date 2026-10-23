import { isCalendlySchedulingAvailable } from './calendly-scheduling-capability';

describe('isCalendlySchedulingAvailable', () => {
  it.each([
    'https://calendly.com/especialista/reuniao',
    'https://www.calendly.com/a',
    'https://CALENDLY.COM/a',
  ])('aceita uma conexão ativa com URL Calendly HTTPS: %s', (calendlyUrl) => {
    expect(
      isCalendlySchedulingAvailable({ calendlyUrl, connectionActive: true }),
    ).toBe(true);
  });

  it.each([
    null,
    '',
    'http://calendly.com/a',
    'https://evilcalendly.com/a',
    'https://calendly.com.evil.test/a',
    'https://calendly.com@evil.test/a',
    'not-a-url',
  ])('rejeita URL inválida ou ausente: %s', (calendlyUrl) => {
    expect(
      isCalendlySchedulingAvailable({ calendlyUrl, connectionActive: true }),
    ).toBe(false);
  });

  it('não permite agendamento com conexão inativa', () => {
    expect(
      isCalendlySchedulingAvailable({
        calendlyUrl: 'https://calendly.com/a',
        connectionActive: false,
      }),
    ).toBe(false);
  });
});
