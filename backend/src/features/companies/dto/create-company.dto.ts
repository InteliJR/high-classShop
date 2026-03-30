import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString() // valida se é uma string
  @IsNotEmpty({ message: 'Nome é obrigatório' }) // valida se não é vazio
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'CNPJ é obrigatório' })
  @Length(14, 14, { message: 'CNPJ deve ter exatamente 14 dígitos' })
  @Matches(/^\d+$/, { message: 'CNPJ deve conter apenas números' })
  cnpj: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsNumber({}, { message: 'Taxa de comissão deve ser um número' })
  @IsOptional()
  @Min(0, { message: 'Taxa de comissão deve ser >= 0' })
  @Max(100, { message: 'Taxa de comissão deve ser <= 100' })
  commission_rate?: number;

  // === DADOS BANCÁRIOS (OPCIONAIS) ===

  @IsString({ message: 'bank deve ser uma string' })
  @IsOptional()
  @MaxLength(100, { message: 'bank deve ter no máximo 100 caracteres' })
  bank?: string;

  @IsString({ message: 'agency deve ser uma string' })
  @IsOptional()
  @MaxLength(10, { message: 'agency deve ter no máximo 10 caracteres' })
  agency?: string;

  @IsString({ message: 'checking_account deve ser uma string' })
  @IsOptional()
  @MaxLength(20, {
    message: 'checking_account deve ter no máximo 20 caracteres',
  })
  checking_account?: string;
}
