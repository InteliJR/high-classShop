import { User } from "@prisma/client";
import { AircraftImage } from "./aircraft-image.entity";

export class Aircraft {
    id: number;
    categoria: string | null;
    specialist_id: string | null;
    ano: number;
    marca: string;
    modelo: string;
    assentos: number | null;
    estado: string;
    descricao: string | null;
    valor: number;
    tipo_aeronave: string | null;
    created_at: Date;
    updated_at: Date;
    
    specialist?: User | null ; 
    images?: AircraftImage[] | null;
}