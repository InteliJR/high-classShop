import { $Enums, Prisma } from '@prisma/client';

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
  document_count?: number;
  last_activity?: Date;
  created_at: Date;
  updated_at?: Date;
}

// TODO: trocar para string quando for trocado para UUID
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
  },
});
export type ProcessWithProducts = Prisma.ProcessGetPayload<
  typeof ProcessWithProducts
>;
