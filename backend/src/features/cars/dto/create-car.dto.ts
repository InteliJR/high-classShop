import { IsString, IsNumber, IsOptional, IsUUID, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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

    @IsNumber()
    valor: number;

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
