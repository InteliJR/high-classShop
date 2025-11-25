import { Car } from "@prisma/client";

export class CarImage {
  id: number;
  product_type: string;
  image_url: string;
  is_primary: boolean;
  car_id?: number | null;
  created_at: Date;
  
  car?: Car;
}
