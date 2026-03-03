import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * DTO para atualizar os dados da empresa da plataforma (singleton).
 * Todos os campos são obrigatórios exceto address e cep.
 */
export class UpdatePlatformCompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'Razão Social é obrigatória' })
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'CNPJ é obrigatório' })
  @MaxLength(18)
  cnpj: string;

  @IsString()
  @IsNotEmpty({ message: 'Banco é obrigatório' })
  @MaxLength(100)
  bank: string;

  @IsString()
  @IsNotEmpty({ message: 'Agência é obrigatória' })
  @MaxLength(10)
  agency: string;

  @IsString()
  @IsNotEmpty({ message: 'Conta Corrente é obrigatória' })
  @MaxLength(20)
  checking_account: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(9)
  cep?: string;

  @IsNumber({}, { message: 'Taxa de comissão padrão deve ser um número' })
  @Min(0, { message: 'Taxa deve ser >= 0' })
  @Max(100, { message: 'Taxa deve ser <= 100' })
  default_commission_rate: number;
}
