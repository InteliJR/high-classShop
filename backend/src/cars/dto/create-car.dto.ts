import { UUID } from "crypto";

export class CreateCarDto {
    id: string;
    marca: string;
    modelo: string;
    valor: number;
    estado: string;
    ano: number;
    cor: string;
    km: number;
    cambio: string;
    combustivel: string;
    tipo_categoria: string;
    descricao: string;
    specialist: UUID;
    images: [
        {
            id: UUID;
            image_url: string;
            is_primary: string;
        },
    ];
    created_at: Date;
    updated_at: Date; 
}
