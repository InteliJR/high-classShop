import { BoatImage } from './boat-image.entity';
import { UserEntity } from 'src/auth/entities/user.entity';

export class Boat {
  id: number;
  is_active: boolean;
  deactivated_at: Date | null;
  deactivated_by_sync_job_id: string | null;
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

  specialist?: UserEntity | null;
  images?: BoatImage[];
}
