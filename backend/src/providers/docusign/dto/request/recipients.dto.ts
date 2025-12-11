import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { SignerDto } from './signer.dto';

export class RecipientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignerDto)
  signers: SignerDto[];
}
