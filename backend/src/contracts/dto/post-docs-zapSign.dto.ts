// Dto para criar um documento no zapSign, para mais detalhes olhar: https://docs.zapsign.com.br/english/documentos/criar-documento

import { IsArray, IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsUrl, ValidateNested } from 'class-validator';

// Define como será a autenticação para a assinatura
export enum AuthMode {
  assinaturaTela = 'assinaturaTela',
  tokenEmail = 'tokenEmail',
  assinaturaTelaTokenEmail = 'assinaturaTela-tokenEmail',
  tokenSms = 'tokenSms',
  assinaturaTelaTokenSms = 'assinaturaTela-tokenSms',
}

export class PostZapSignDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsUrl()
  url_pdf: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested()
  signers: Signer[];

  @IsNotEmpty()
  folder_path: string;

  @IsNotEmpty()
  @IsEmail()
  created_by: string; // E-mail de quem criou o contrato

  @IsOptional()
  @IsDateString()
  date_limit_sign: string;

  @IsOptional()
  @IsInt()
  reminder_every_n_days: number;
}

// Classe para os assinantes do contrato
export class Signer {
  @IsNotEmpty()
  auth_mode: AuthMode;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;
}
