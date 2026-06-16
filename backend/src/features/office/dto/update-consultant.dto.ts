import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * Campos permitidos para OFFICE editar em consultor.
 * NUNCA inclui role, company_id, id, email, cpf, password — qualquer extra é
 * descartado pelo ValidationPipe global ({ whitelist: true }).
 */
export class OfficeUpdateConsultantDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) surname?: string;

  @IsOptional() @IsString() @MaxLength(120) bank?: string;
  @IsOptional() @IsString() @MaxLength(10) agency?: string;
  @IsOptional() @IsString() @MaxLength(20) checking_account?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'commission_rate deve ser numérico' },
  )
  @Min(0, { message: 'commission_rate mínimo 0' })
  @Max(100, { message: 'commission_rate máximo 100' })
  commission_rate?: number;
}
