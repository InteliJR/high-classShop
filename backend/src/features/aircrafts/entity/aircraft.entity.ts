import { AircraftImage } from './aircraft-image.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import { ProductCurrency } from '@prisma/client';

export class Aircraft {
  id: string;
  is_active: boolean;
  deactivated_at: Date | null;
  deactivated_by_sync_job_id: string | null;
  categoria: string | null;
  specialist_id: string | null;
  ano: number;
  marca: string;
  modelo: string;
  assentos: number | null;
  estado: string;
  descricao: string | null;
  valor: number;
  currency: ProductCurrency;
  tipo_aeronave: string | null;
  created_at: Date;
  updated_at: Date;

  specialist?: UserEntity | null;
  images?: AircraftImage[] | null;
}
