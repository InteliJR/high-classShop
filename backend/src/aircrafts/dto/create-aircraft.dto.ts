import { UUID } from "crypto";

export class CreateAircraftDto {
    id: string;
    categoria: string;
    ano: number;
    marca: string;
    modelo: string;
    assentos: number;
    estado: string;
    descricao: string;
    valor: number;
    tipo_aeronave: string
    specialist_id?: string;
    images?: string; //Fix
    created_at: Date;
    updated_at: Date;
}
