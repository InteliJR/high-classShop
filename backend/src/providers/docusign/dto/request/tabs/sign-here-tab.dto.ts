import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class SignHereTabDto {
  @IsString()
  @IsNotEmpty()
  anchorString: string;

  @IsOptional()
  @IsString()
  anchorUnits?: string;

  @IsOptional()
  @IsString()
  anchorXOffset?: string;

  @IsOptional()
  @IsString()
  anchorYOffset?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  optional?: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsOptional()
  @IsNumber()
  scaleValue?: number;

  @IsOptional()
  @IsString()
  tabLabel?: string;
}
