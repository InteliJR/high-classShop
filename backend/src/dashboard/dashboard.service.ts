import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats() {
    // 1. Contar escritórios ativos (total de companies)
    const activeCompanies = await this.prisma.company.count();

    // 2. Contar processos ativos (apenas SCHEDULING e NEGOTIATION)
    const activeProcesses = await this.prisma.process.count({
      where: {
        status: {
          in: ['SCHEDULING', 'NEGOTIATION'],
        },
      },
    });

    // 3. Calcular taxa de conversão
    const totalProcesses = await this.prisma.process.count();
    const completedProcesses = await this.prisma.process.count({
      where: {
        status: 'COMPLETED',
      },
    });

    // Taxa de conversão = (processos completados / total de processos) * 100
    const conversionRate = totalProcesses > 0
      ? Math.round((completedProcesses / totalProcesses) * 100)
      : 0;

    return {
      activeProcesses,
      conversionRate,
      activeCompanies,
    };
  }
}

