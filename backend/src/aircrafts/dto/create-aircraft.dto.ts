import { IsString, IsNumber, IsOptional, IsUUID, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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

    @IsNumber()
    valor: number;

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
