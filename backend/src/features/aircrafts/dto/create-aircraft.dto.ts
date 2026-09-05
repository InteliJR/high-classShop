import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCurrency } from '@prisma/client';

class ImageDto {
  @IsString()
  data: string; // base64 string

  @IsBoolean()
  is_primary: boolean;
}

export class CreateAircraftDto {
  @IsString()
  marca: string;

  @IsString()
  modelo: string;

  @IsString()
  identificador: string;

  @IsNumber()
  valor: number;

  @IsOptional()
  @IsEnum(ProductCurrency)
  currency?: ProductCurrency;

  @IsString()
  estado: string;

  @IsNumber()
  ano: number;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsNumber()
  assentos?: number;

  @IsOptional()
  @IsString()
  tipo_aeronave?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsUUID()
  specialist_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}
