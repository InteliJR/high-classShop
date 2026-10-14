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

const CALENDLY_RESOURCE_PATHS: Record<CalendlyResourceKind, RegExp> = {
  event: /^\/scheduled_events\/[A-Za-z0-9_-]+$/,
  invitee: /^\/scheduled_events\/[A-Za-z0-9_-]+\/invitees\/[A-Za-z0-9_-]+$/,
};

export function isCalendlyResourceUri(
  value: unknown,
  kind: CalendlyResourceKind,
): value is string {
  if (typeof value !== 'string') return false;

  try {
    const uri = new URL(value);
    return (
      uri.protocol === 'https:' &&
      uri.hostname === 'api.calendly.com' &&
      uri.port === '' &&
      uri.username === '' &&
      uri.password === '' &&
      uri.search === '' &&
      uri.hash === '' &&
      CALENDLY_RESOURCE_PATHS[kind].test(uri.pathname)
    );
  } catch {
    return false;
  }
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

  @IsOptional()
  @IsISO8601(
    {},
    { message: 'scheduled_start_time deve estar em formato ISO 8601 válido' },
  )
  scheduled_start_time?: string;
}
