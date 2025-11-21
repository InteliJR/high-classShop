import { Aircraft } from "@prisma/client";

export class AircraftImage {
  id: number;
  product_type: string;
  image_url: string;
  is_primary: boolean;
  aircraft_id?: number | null;
  created_at: Date;
  
  aircraft?: Aircraft;
}