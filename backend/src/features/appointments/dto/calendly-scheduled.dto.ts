import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export type CalendlyResourceKind = 'event' | 'invitee';

export interface CalendlyResourceReference {
  canonicalUri: string;
  canonicalEventUri: string;
  eventId: string;
  inviteeId?: string;
}

const CALENDLY_RESOURCE_PATTERNS = [
  /^https:\/\/api\.calendly\.com(?::443)?\/(?:api\/v2\/)?scheduled_events\/([A-Za-z0-9_-]+)(?:\/invitees\/([A-Za-z0-9_-]+))?$/i,
  /^https:\/\/calendly\.com(?::443)?\/api\/v2\/scheduled_events\/([A-Za-z0-9_-]+)(?:\/invitees\/([A-Za-z0-9_-]+))?$/i,
];

export function parseCalendlyResourceUri(
  value: unknown,
  kind: CalendlyResourceKind,
): CalendlyResourceReference | null {
  if (typeof value !== 'string') return null;

  const match = CALENDLY_RESOURCE_PATTERNS.map((pattern) =>
    pattern.exec(value),
  ).find((candidate) => candidate?.[0] === value);
  if (!match) return null;

  const [, eventId, inviteeId] = match;
  if (
    (kind === 'event' && inviteeId !== undefined) ||
    (kind === 'invitee' && inviteeId === undefined)
  ) {
    return null;
  }

  const canonicalEventUri =
    `https://api.calendly.com/scheduled_events/${eventId}`;
  return {
    eventId,
    inviteeId,
    canonicalEventUri,
    canonicalUri:
      kind === 'invitee'
        ? `${canonicalEventUri}/invitees/${inviteeId}`
        : canonicalEventUri,
  };
}

export function getCalendlyResourceUriVariants(
  reference: CalendlyResourceReference,
): string[] {
  const resourcePath = reference.inviteeId
    ? `scheduled_events/${reference.eventId}/invitees/${reference.inviteeId}`
    : `scheduled_events/${reference.eventId}`;

  return [
    `https://api.calendly.com/${resourcePath}`,
    `https://api.calendly.com:443/${resourcePath}`,
    `https://api.calendly.com/api/v2/${resourcePath}`,
    `https://api.calendly.com:443/api/v2/${resourcePath}`,
    `https://calendly.com/api/v2/${resourcePath}`,
    `https://calendly.com:443/api/v2/${resourcePath}`,
  ];
}

export function isCalendlyResourceUri(
  value: unknown,
  kind: CalendlyResourceKind,
): value is string {
  return parseCalendlyResourceUri(value, kind) !== null;
}

function IsCalendlyResourceUri(
  kind: CalendlyResourceKind,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isCalendlyResourceUri',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      constraints: [kind],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          return isCalendlyResourceUri(
            value,
            args.constraints[0] as CalendlyResourceKind,
          );
        },
      },
    });
  };
}

export class CalendlyScheduledDto {
  @IsString({ message: 'event_uri deve ser uma string' })
  @MaxLength(255, { message: 'event_uri deve ter no máximo 255 caracteres' })
  @IsCalendlyResourceUri('event', {
    message: 'event_uri deve apontar para um evento da API do Calendly',
  })
  event_uri: string;

  @IsString({ message: 'invitee_uri deve ser uma string' })
  @MaxLength(255, { message: 'invitee_uri deve ter no máximo 255 caracteres' })
  @IsCalendlyResourceUri('invitee', {
    message: 'invitee_uri deve apontar para um convidado da API do Calendly',
  })
  invitee_uri: string;

  @IsOptional()
  @IsIn(['calendly.event_scheduled'], {
    message: 'client_event deve ser calendly.event_scheduled',
  })
  client_event?: 'calendly.event_scheduled';

  @IsOptional()
  @IsISO8601(
    {},
    { message: 'client_observed_at deve estar em formato ISO 8601 válido' },
  )
  client_observed_at?: string;

}
