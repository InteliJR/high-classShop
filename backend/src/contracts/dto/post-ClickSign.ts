import { IsArray, IsDateString, IsEmail, IsNotEmpty, IsOptional, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Métodos de autenticação do Clicksign
export enum ClicksignAuth {
  EMAIL = 'email',
  SMS = 'sms',
  CLICK = 'click', // equivalente a assinatura na tela
}

// DTO do signatário
export class ClicksignSigner {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  name: string;

  @IsOptional()
  phone?: string;

  @IsArray()
  @IsNotEmpty({ each: true })
  auths: ClicksignAuth[];
}

// DTO do documento
export class PostClicksignDto {
  @IsNotEmpty()
  name: string; // nome do documento

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClicksignSigner)
  signers: ClicksignSigner[];

  @IsNotEmpty()
  @IsUrl()
  url_pdf: string; // link do PDF a ser assinado

  @IsOptional()
  @IsDateString()
  deadline_at?: string; // prazo limite para assinatura

  @IsOptional()
  auto_close?: boolean; // finaliza automaticamente
}
