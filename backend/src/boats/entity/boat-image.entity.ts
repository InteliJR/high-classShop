import { Boat } from '@prisma/client';

export class BoatImage {
  id: number;
  product_type: string;
  image_url: string;
  is_primary: boolean;
  created_at: Date;

  boat_id?: number | null;
  boat?: Boat;
}
