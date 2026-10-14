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
    'https://evil/scheduled_events/event-123',
    'https://evil.test/scheduled_events/event-123',
    'https://calendly.com.evil/scheduled_events/event-123',
    'https://api.calendly.com.evil.test/scheduled_events/event-123',
    'http://api.calendly.com/scheduled_events/event-123',
    'https://user:password@api.calendly.com/scheduled_events/event-123',
    'https://api.calendly.com:444/scheduled_events/event-123',
    'https://127.0.0.1/scheduled_events/event-123',
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
    'https://api.calendly.com:444/scheduled_events/event-123/invitees/invitee-456',
    'https://127.0.0.1/scheduled_events/event-123/invitees/invitee-456',
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
