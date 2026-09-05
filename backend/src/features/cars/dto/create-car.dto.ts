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

export class CreateCarDto {
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
  cor?: string;

  @IsOptional()
  @IsNumber()
  km?: number;

  @IsOptional()
  @IsString()
  cambio?: string;

  @IsOptional()
  @IsString()
  combustivel?: string;

  @IsOptional()
  @IsString()
  tipo_categoria?: string;

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
