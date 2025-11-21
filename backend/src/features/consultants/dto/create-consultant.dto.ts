import { IsString, IsNotEmpty, IsEmail, Length, Matches, IsUUID } from 'class-validator';

export class CreateConsultantDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Sobrenome é obrigatório' })
  surname: string;

  @IsEmail({}, { message: 'Email deve ter formato válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório' })
  @Length(11, 11, { message: 'CPF deve ter exatamente 11 dígitos' })
  @Matches(/^\d+$/, { message: 'CPF deve conter apenas números' })
  cpf: string;

  @IsString()
  @IsNotEmpty({ message: 'RG é obrigatório' })
  @Length(10, 10, { message: 'RG deve ter exatamente 10 dígitos' })
  @Matches(/^\d+$/, { message: 'RG deve conter apenas números' })
  rg: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Company ID é obrigatório' })
  company_id: string;
}
