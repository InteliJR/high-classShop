import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { DocumentDto } from './document.dto';
import { RecipientsDto } from './recipients.dto';
import { EnvelopeStatus } from '../../enums/envelope-status.enum';

export class CreateEnvelopeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @IsNotEmpty()
  emailSubject: string;

  @ValidateNested()
  @Type(() => RecipientsDto)
  recipients: RecipientsDto;

  @IsEnum(EnvelopeStatus)
  status: 'sent' | 'created';
}
