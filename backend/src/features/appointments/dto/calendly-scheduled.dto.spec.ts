import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CalendlyScheduledDto } from './calendly-scheduled.dto';

describe('CalendlyScheduledDto — Calendly resource URIs', () => {
  const validPayload = {
    event_uri: 'https://api.calendly.com/scheduled_events/event-123',
    invitee_uri:
      'https://api.calendly.com/scheduled_events/event-123/invitees/invitee-456',
  };

  async function invalidProperties(payload: Record<string, unknown>) {
    const errors = await validate(
      plainToInstance(CalendlyScheduledDto, {
        ...validPayload,
        ...payload,
      }),
    );
    return errors.map((error) => error.property);
  }

  it('aceita somente os caminhos canônicos de evento e convidado', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
  });

  it('não expõe scheduled_start_time como campo confiável do contrato', async () => {
    const errors = await validate(
      plainToInstance(CalendlyScheduledDto, {
        ...validPayload,
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'scheduled_start_time' }),
      ]),
    );
  });

  it('aceita HTTPS com a porta padrão explícita', async () => {
    await expect(
      invalidProperties({
        event_uri:
          'https://api.calendly.com:443/scheduled_events/event-123',
        invitee_uri:
          'https://api.calendly.com:443/scheduled_events/event-123/invitees/invitee-456',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    {
      event_uri:
        'https://calendly.com/api/v2/scheduled_events/event-123',
      invitee_uri:
        'https://calendly.com/api/v2/scheduled_events/event-123/invitees/invitee-456',
    },
    {
      event_uri:
        'https://api.calendly.com/api/v2/scheduled_events/event-123',
      invitee_uri:
        'https://api.calendly.com/api/v2/scheduled_events/event-123/invitees/invitee-456',
    },
  ])('aceita a família oficial usada pelo react-calendly: %o', async (uris) => {
    await expect(invalidProperties(uris)).resolves.toEqual([]);
  });

  it.each([
    'https://evil/scheduled_events/event-123',
    'https://evil.test/scheduled_events/event-123',
    'https://calendly.com.evil/scheduled_events/event-123',
    'https://api.calendly.com.evil.test/scheduled_events/event-123',
    'http://api.calendly.com/scheduled_events/event-123',
    'https://user:password@api.calendly.com/scheduled_events/event-123',
    'https://%61pi.calendly.com@evil.test/scheduled_events/event-123',
    'https://api.calendly.com\\@evil.test/scheduled_events/event-123',
    'https://api.calendly.com:444/scheduled_events/event-123',
    'https://127.0.0.1/scheduled_events/event-123',
    'https://api.calendly.com/scheduled_events/event%2f123',
    'https://api.calendly.com/scheduled_events/event%3fadmin',
    'https://api.calendly.com/scheduled_events/event%23admin',
    'https://api.calendly.com/scheduled_events/ignored/../event-123',
    'https://api.calendly.com/scheduled_events/event-123/invitees/invitee-456',
  ])('rejeita event_uri fora do recurso esperado: %s', async (event_uri) => {
    await expect(invalidProperties({ event_uri })).resolves.toContain(
      'event_uri',
    );
  });

  it.each([
    'https://evil/scheduled_events/event-123/invitees/invitee-456',
    'https://evil.test/scheduled_events/event-123/invitees/invitee-456',
    'https://calendly.com.evil/scheduled_events/event-123/invitees/invitee-456',
    'https://api.calendly.com.evil.test/scheduled_events/event-123/invitees/invitee-456',
    'http://api.calendly.com/scheduled_events/event-123/invitees/invitee-456',
    'https://user@api.calendly.com/scheduled_events/event-123/invitees/invitee-456',
    'https://%61pi.calendly.com@evil.test/scheduled_events/event-123/invitees/invitee-456',
    'https://api.calendly.com\\@evil.test/scheduled_events/event-123/invitees/invitee-456',
    'https://api.calendly.com:444/scheduled_events/event-123/invitees/invitee-456',
    'https://127.0.0.1/scheduled_events/event-123/invitees/invitee-456',
    'https://api.calendly.com/scheduled_events/event%2f123/invitees/invitee-456',
    'https://api.calendly.com/scheduled_events/event-123/invitees/invitee%3f456',
    'https://api.calendly.com/scheduled_events/event-123/invitees/invitee%23456',
    'https://api.calendly.com/scheduled_events/event-123/invitees/ignored/../invitee-456',
    'https://api.calendly.com/scheduled_events/event-123',
  ])(
    'rejeita invitee_uri fora do recurso esperado: %s',
    async (invitee_uri) => {
      await expect(invalidProperties({ invitee_uri })).resolves.toContain(
        'invitee_uri',
      );
    },
  );
});
