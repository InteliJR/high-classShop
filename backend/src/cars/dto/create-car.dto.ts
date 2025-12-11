import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

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
}
