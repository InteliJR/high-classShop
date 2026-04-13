import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CalendlyScheduledDto {
  @IsString({ message: 'event_uri deve ser uma string' })
  @MaxLength(255, { message: 'event_uri deve ter no máximo 255 caracteres' })
  event_uri: string;

  @IsString({ message: 'invitee_uri deve ser uma string' })
  @MaxLength(255, { message: 'invitee_uri deve ter no máximo 255 caracteres' })
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
