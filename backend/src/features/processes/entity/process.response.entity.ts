import { $Enums, Prisma } from '@prisma/client';

export class ProcessResponse {
  id: string;
  status: $Enums.ProcessStatus;
  appointment_id?: string | null;
  appointment_status?: $Enums.StatusAgendamento | null;
  appointment_datetime?: Date | null;
  appointment_scheduling_method?:
    | $Enums.AppointmentSchedulingMethod
    | null;
  specialist_rescheduled_at?: Date | null;
  specialist_rescheduled_from?: Date | null;
  product_type: $Enums.ProductType | null; // Null para processos de consultoria
  product_id?: string | null; // ID do produto (car_id, boat_id, ou aircraft_id)
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  specialist: {
    id: string;
    name: string;
    especialidade: $Enums.ProductType | null;
    phone?: string | null;
  };
  product: Product | null;
  notes: string | null;
  document_count?: number;
  last_activity?: Date;
  created_at: Date;
  updated_at?: Date;
}

export class Product {
  id: string;
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
