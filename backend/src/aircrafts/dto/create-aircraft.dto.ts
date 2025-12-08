import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

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
}
