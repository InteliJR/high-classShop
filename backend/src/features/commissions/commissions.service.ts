import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface SaleCommission {
  processId: string;
  productType: string | null;
  productLabel: string;
  clientName: string;
  specialistName: string;
  saleValue: number;
  totalCommission: number;
  totalCommissionRate: number; // % da venda
  specialistValue: number;
  officeName: string | null;
  officeValue: number; // 0 quando não há escritório
  platformValue: number;
  restante: number; // parte da comissão após o especialista (escritório + plataforma)
  signedAt: Date | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista o fluxo de comissão de cada venda fechada (contrato assinado),
   * lendo os valores do snapshot do contrato. Visão consolidada do ADMIN.
   */
  async listSales(): Promise<SaleCommission[]> {
    const contracts = await this.prisma.contract.findMany({
      where: { status: 'SIGNED' },
      orderBy: { signed_at: 'desc' },
      include: {
        process: {
          include: {
            client: true,
            specialist: true,
            car: true,
            boat: true,
            aircraft: true,
            accepted_proposal: true,
          },
        },
      },
    });

    return contracts.map((c) => {
      const p = c.process;
      const specialistValue = Number(c.specialist_commission_value ?? 0);
      const officeValue = Number(c.office_value ?? 0);
      const platformValue = Number(c.platform_value ?? 0);
      const totalCommission = round2(
        specialistValue + officeValue + platformValue,
      );
      const saleValue = Number(
        c.vehicle_price ?? p?.accepted_proposal?.proposed_value ?? 0,
      );

      const product =
        p?.product_type === 'CAR'
          ? p.car
          : p?.product_type === 'BOAT'
            ? p.boat
            : p?.product_type === 'AIRCRAFT'
              ? p.aircraft
              : null;
      const productLabel = product
        ? `${product.marca} ${product.modelo}`
        : 'Consultoria';

      const fullName = (
        u: { name: string | null; surname: string | null } | null | undefined,
      ) => (u ? `${u.name ?? ''} ${u.surname ?? ''}`.trim() : '—');

      return {
        processId: p?.id ?? c.process_id,
        productType: p?.product_type ?? null,
        productLabel,
        clientName: fullName(p?.client),
        specialistName: c.specialist_name ?? fullName(p?.specialist),
        saleValue,
        totalCommission,
        totalCommissionRate:
          saleValue > 0 ? round2((totalCommission / saleValue) * 100) : 0,
        specialistValue,
        officeName: c.office_name ?? null,
        officeValue,
        platformValue,
        restante: round2(officeValue + platformValue),
        signedAt: c.signed_at,
      };
    });
  }
}
