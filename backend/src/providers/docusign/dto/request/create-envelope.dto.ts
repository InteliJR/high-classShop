import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { EnvelopeStatus } from '../../enums/envelope-status.enum';
import { DocumentDto } from './document.dto';
import { SignerDto } from './signer.dto';
import { TabsDto } from './tabs/tabs.dto';

/* ======================================================
 * RECIPIENTS
 * ====================================================== */
class RecipientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignerDto)
  signers: SignerDto[];
}

/* ======================================================
 * CREATE ENVELOPE (EXPORTADO)
 * ====================================================== */
export class CreateEnvelopeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @IsString()
  @IsNotEmpty()
  emailSubject: string;

  @ValidateNested()
  @Type(() => RecipientsDto)
  recipients: RecipientsDto;

  @IsEnum(EnvelopeStatus)
  status: EnvelopeStatus;
}
