import { BoatImage } from './boat-image.entity';

export class Boat {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  fabricante: string | null;
  tamanho: string | null;
  estilo: string | null;
  combustivel: string | null;
  motor: string | null;
  ano_motor: number | null;
  tipo_embarcacao: string | null;
  descricao: string | null;
  acessorios: string | null;
  specialist_id: string | null;
  created_at: Date;
  updated_at: Date;

  images?: BoatImage[];
}
