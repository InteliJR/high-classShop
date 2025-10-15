import { Specialist, Image } from "./index";

export class Car {
    id: String;
    marca: String;
    modelo: String;
    valor: number;
    estado: String;
    ano: number;
    cor: String;
    km: number;
    cambio: String;
    combustivel: String;
    tipo_categoria: String;
    descricao: String;
    specialist: Specialist;
    images: Image;
    created_at: Date;
    updated_at: Date;
}
