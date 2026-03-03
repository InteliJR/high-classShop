import { IsBase64, IsNotEmpty, IsString } from 'class-validator';

export class DocumentDto {
  @IsBase64()
  documentBase64: string;

  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  fileExtension: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
