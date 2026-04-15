import { CarImage } from './car-image.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
export class Car {
  id: number;
  specialist_id: string | null;
  is_active: boolean;
  deactivated_at: Date | null;
  deactivated_by_sync_job_id: string | null;
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

  specialist?: UserEntity | null;

  images?: CarImage[] | null;
}
