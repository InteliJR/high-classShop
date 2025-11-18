import { UUID } from "crypto";

export class CreateBoatDto {
    id: string;
    marca: string;
    modelo: string;
    valor: number;
    estado: string;
    ano: number;
    fabricante: string;
    tamanho: string;
    estilo: string;
    combustivel: string;
    motor: string;
    ano_motor: number;
    tipo_embarcacao: string;
    descricao_completa: string;
    acessorios: string;
    specialist_id?: string; //Fix
    created_at: Date;
    updated_at: Date;
}
