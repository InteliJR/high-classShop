import { User } from "@prisma/client";
import { CarImage } from "./car-image.entity";
export class Car {
    id: number;
    specialist_id: string | null;
    marca: string;
    modelo: string;
    valor: number;
    estado: string;
    ano: number;
    cor: string | null;
    km: number | null;
    cambio: string | null;
    combustivel: string | null;
    tipo_categoria: string | null;
    descricao: string | null;
    created_at: Date;
    updated_at: Date;

    specialist?: User | null;

    images?: CarImage[] | null;
}
