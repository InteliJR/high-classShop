import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
    const conversionRate =
      totalProcesses > 0
        ? Math.round((completedProcesses / totalProcesses) * 100)
        : 0;

    const salesByMonth = await this.buildMonthlySalesData({});
    const consultantsPerformance = await this.getConsultantsPerformance();

    return {
      activeProcesses,
      conversionRate,
      activeCompanies,
      salesByMonth,
      consultantsPerformance,
    };
  }

  async getSpecialistStats(specialistId: string) {
    // Buscar o especialista para saber sua especialidade
    const specialist = await this.prisma.user.findUnique({
      where: { id: specialistId },
      select: { speciality: true },
    });

    // 1. Contar produtos cadastrados APENAS do especialista logado
    let productsListed = 0;

    if (specialist?.speciality === 'CAR') {
      productsListed = await this.prisma.car.count({
        where: { specialist_id: specialistId },
      });
    } else if (specialist?.speciality === 'BOAT') {
      productsListed = await this.prisma.boat.count({
        where: { specialist_id: specialistId },
      });
    } else if (specialist?.speciality === 'AIRCRAFT') {
      productsListed = await this.prisma.aircraft.count({
        where: { specialist_id: specialistId },
      });
    }

    // 2. Contar processos ativos (apenas SCHEDULING e NEGOTIATION)
    const activeProcesses = await this.prisma.process.count({
      where: {
        specialist_id: specialistId,
        status: {
          in: ['SCHEDULING', 'NEGOTIATION'],
        },
      },
    });

    // 3. Contar vendas concluídas
    const completedSales = await this.prisma.process.count({
      where: {
        specialist_id: specialistId,
        status: 'COMPLETED',
      },
    });

    // 4. Calcular taxa de conversão
    const totalProcesses = await this.prisma.process.count({
      where: { specialist_id: specialistId },
    });
    const conversionRate =
      totalProcesses > 0
        ? Math.round((completedSales / totalProcesses) * 100)
        : 0;

    // 5. Dados para gráfico de vendas por mês (últimos 12 meses)
    const monthsData = await this.buildMonthlySalesData({
      specialist_id: specialistId,
    });

    // 6. Dados para gráfico de pizza - processos por status
    const processesByStatus = await this.prisma.process.groupBy({
      by: ['status'],
      where: {
        specialist_id: specialistId,
      },
      _count: {
        status: true,
      },
    });

    const statusData = processesByStatus.map((item) => ({
      name: this.translateStatus(item.status),
      value: item._count.status,
    }));

    return {
      productsListed,
      activeProcesses,
      completedSales,
      conversionRate,
      salesByMonth: monthsData,
      processesByStatus: statusData,
    };
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      SCHEDULING: 'Agendamento',
      NEGOTIATION: 'Negociação',
      DOCUMENTATION: 'Documentação',
      COMPLETED: 'Concluído',
      CANCELLED: 'Cancelado',
    };
    return statusMap[status] || status;
  }

  private async buildMonthlySalesData(baseWhere: Record<string, any>) {
    const currentDate = new Date();
    const monthsData = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );
      const nextMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        1,
      );

      const completed = await this.prisma.process.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          updated_at: {
            gte: date,
            lt: nextMonth,
          },
        },
      });

      const notCompleted = await this.prisma.process.count({
        where: {
          ...baseWhere,
          status: {
            not: 'COMPLETED',
          },
          created_at: {
            gte: date,
            lt: nextMonth,
          },
        },
      });

      monthsData.push({
        month: date
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', ''),
        vendidos: completed,
        naoVendidos: notCompleted,
      });
    }

    return monthsData;
  }

  private async getConsultantsPerformance() {
    const consultants = await this.prisma.user.findMany({
      where: { role: 'CONSULTANT' },
      select: { id: true, name: true, surname: true },
    });

    const performance = await Promise.all(
      consultants.map(async (consultant) => {
        const completedSales = await this.prisma.process.count({
          where: {
            status: 'COMPLETED',
            client: { consultant_id: consultant.id },
          },
        });

        return {
          name: `${consultant.name} ${consultant.surname}`,
          value: completedSales,
        };
      }),
    );

    const totalCompleted = performance.reduce(
      (sum, item) => sum + item.value,
      0,
    );

    return performance
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        value: item.value,
        percentage: totalCompleted
          ? Math.round((item.value / totalCompleted) * 100)
          : 0,
      }));
  }
}
