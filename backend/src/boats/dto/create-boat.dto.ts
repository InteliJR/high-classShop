import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateBoatDto {
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
    fabricante?: string;

    @IsOptional()
    @IsString()
    tamanho?: string;

    @IsOptional()
    @IsString()
    estilo?: string;

    @IsOptional()
    @IsString()
    combustivel?: string;

    @IsOptional()
    @IsString()
    motor?: string;

    @IsOptional()
    @IsNumber()
    ano_motor?: number;

    @IsOptional()
    @IsString()
    tipo_embarcacao?: string;

    @IsOptional()
    @IsString()
    descricao_completa?: string;

    @IsOptional()
    @IsString()
    acessorios?: string;

    @IsOptional()
    @IsUUID()
    specialist_id?: string;
}
