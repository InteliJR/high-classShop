import { Specialist, Image} from "./index"

export class Aircrafts {
    id: String;
    categoria: String;
    ano: number;
    marca: String;
    modelo: String;
    assentos: number;
    estado: String;
    descricao: String;
    valor: number;
    tipo_aeronave: String
    specialist: Specialist;
    images: Image;
    created_at: Date;
    updated_at: Date;
}