import { Image, Specialist } from "./index";

export class Boat {
    id: String;
    marca: String;
    modelo: String;
    valor: number;
    estado: String;
    ano: number;
    fabricante: String;
    tamanho: String;
    estilo: String;
    combustivel: String;
    motor: String;
    ano_motor: String;
    tipo_embarcacao: String
    descricao: String;
    acessorios: String;
    specialist: Specialist;
    images: Image;
    created_at: Date;
    updated_at: Date;
}