import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FullNameTabDto {
  @IsString()
  @IsNotEmpty()
  anchorString: string;

  @IsOptional()
  @IsString()
  anchorYOffset?: string;

  @IsOptional()
  @IsString()
  fontSize?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsOptional()
  @IsString()
  tabLabel?: string;
}
