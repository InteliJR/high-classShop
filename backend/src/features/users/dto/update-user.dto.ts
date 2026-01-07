import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * DTO para atualizar dados do usuário
 *
 * Campos editáveis:
 * - name: nome do usuário
 * - surname: sobrenome
 * - cpf: CPF (11 dígitos) - único no sistema
 * - rg: RG (até 10 dígitos) - único no sistema
 * - calendly_url: link do Calendly (apenas para especialistas)
 *
 * Validações:
 * - CPF: exatamente 11 dígitos numéricos
 * - RG: até 10 dígitos numéricos
 * - calendly_url: URL válida do Calendly
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Sobrenome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Sobrenome deve ter no máximo 100 caracteres' })
  surname?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'CPF deve conter exatamente 11 dígitos numéricos',
  })
  cpf?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}$/, { message: 'RG deve conter até 10 dígitos numéricos' })
  rg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'URL do Calendly deve ter no máximo 255 caracteres',
  })
  calendly_url?: string;
}
