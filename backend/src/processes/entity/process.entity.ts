import { $Enums, Prisma,} from '@prisma/client';

export class ProcessResponse {
  id: string;
  status: $Enums.ProcessStatus;
  product_type: $Enums.ProductType;
  client: {
    id: string;
    name: string;
    email: string;
  };
  specialist: {
    id: string;
    name: string;
    especialidade: $Enums.ProductType | null;
  };
  product: Product | null;
  notes: string | null;
  created_at: Date;
}

export class Product {
  id: number;
  marca: string;
  modelo: string;
}

const ProcessWithProducts = Prisma.validator<Prisma.ProcessDefaultArgs>()({
  include: {
    aircraft: true,
    boat: true,
    car: true,
  }
})
export type ProcessWithProducts = Prisma.ProcessGetPayload<typeof ProcessWithProducts>

