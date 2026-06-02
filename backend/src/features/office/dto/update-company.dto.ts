import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Campos permitidos para OFFICE editar na própria Company.
 * NUNCA inclui id (que poderia ser usado pra trocar de tenant).
 * Logo é tratado separado pelo endpoint multipart de upload.
 */
export class OfficeUpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'CNPJ inválido (apenas 14 dígitos ou formato XX.XXX.XXX/XXXX-XX)',
  })
  cnpj?: string;

  @IsOptional() @IsString() @MaxLength(120) bank?: string;
  @IsOptional() @IsString() @MaxLength(10)  agency?: string;
  @IsOptional() @IsString() @MaxLength(20)  checking_account?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_rate?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4, { message: 'Máximo 4 cores (primary, secondary, accent, neutral)' })
  @Matches(HEX_COLOR, { each: true, message: 'Cor deve ser hex (#RGB ou #RRGGBB)' })
  color_identity?: string[];
}
