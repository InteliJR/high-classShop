import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats() {
    // Todas as consultas independentes rodam em paralelo (antes eram sequenciais).
    const [
      activeCompanies,
      activeProcesses,
      totalProcesses,
      completedProcesses,
      totalClients,
      specialistsCount,
      totalCars,
      totalBoats,
      totalAircrafts,
      salesByMonth,
      consultantsPerformance,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.process.count({
        where: { status: { in: ['SCHEDULING', 'NEGOTIATION'] } },
      }),
      this.prisma.process.count(),
      this.prisma.process.count({ where: { status: 'COMPLETED' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'SPECIALIST' } }),
      this.prisma.car.count(),
      this.prisma.boat.count(),
      this.prisma.aircraft.count(),
      this.buildMonthlySalesData({}),
      this.getConsultantsPerformance(),
    ]);

    // Taxa de conversão = (processos completados / total de processos) * 100
    const conversionRate =
      totalProcesses > 0
        ? Math.round((completedProcesses / totalProcesses) * 100)
        : 0;

    const totalProducts = totalCars + totalBoats + totalAircrafts;

    return {
      activeProcesses,
      conversionRate,
      activeCompanies,
      totalClients,
      specialistsCount,
      totalProducts,
      productsByType: {
        cars: totalCars,
        boats: totalBoats,
        aircrafts: totalAircrafts,
      },
      salesByMonth,
      consultantsPerformance,
    };
  }

  async getSpecialistStats(specialistId: string) {
    // Buscar o especialista para saber sua especialidade (necessário antes das
    // contagens de produto).
    const specialist = await this.prisma.user.findUnique({
      where: { id: specialistId },
      select: { speciality: true },
    });

    // Contagem de produtos do especialista depende da especialidade dele.
    const productsListedPromise =
      specialist?.speciality === 'CAR'
        ? this.prisma.car.count({ where: { specialist_id: specialistId } })
        : specialist?.speciality === 'BOAT'
          ? this.prisma.boat.count({ where: { specialist_id: specialistId } })
          : specialist?.speciality === 'AIRCRAFT'
            ? this.prisma.aircraft.count({
                where: { specialist_id: specialistId },
              })
            : Promise.resolve(0);

    const [
      productsListed,
      activeProcesses,
      completedSales,
      totalProcesses,
      monthsData,
      processesByStatus,
    ] = await Promise.all([
      productsListedPromise,
      this.prisma.process.count({
        where: {
          specialist_id: specialistId,
          status: { in: ['SCHEDULING', 'NEGOTIATION'] },
        },
      }),
      this.prisma.process.count({
        where: { specialist_id: specialistId, status: 'COMPLETED' },
      }),
      this.prisma.process.count({ where: { specialist_id: specialistId } }),
      this.buildMonthlySalesData({ specialist_id: specialistId }),
      this.prisma.process.groupBy({
        by: ['status'],
        where: { specialist_id: specialistId },
        _count: { status: true },
      }),
    ]);

    const conversionRate =
      totalProcesses > 0
        ? Math.round((completedSales / totalProcesses) * 100)
        : 0;

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

    // Janelas dos últimos 12 meses (mais antigo → mais recente), como antes.
    const windows = Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx;
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
      return { date, nextMonth };
    });

    // As 24 contagens (12 meses × 2) rodam em paralelo em vez de sequencialmente.
    return Promise.all(
      windows.map(async ({ date, nextMonth }) => {
        const [completed, notCompleted] = await Promise.all([
          this.prisma.process.count({
            where: {
              ...baseWhere,
              status: 'COMPLETED',
              updated_at: { gte: date, lt: nextMonth },
            },
          }),
          this.prisma.process.count({
            where: {
              ...baseWhere,
              status: { not: 'COMPLETED' },
              created_at: { gte: date, lt: nextMonth },
            },
          }),
        ]);

        return {
          month: date
            .toLocaleDateString('pt-BR', { month: 'short' })
            .replace('.', ''),
          vendidos: completed,
          naoVendidos: notCompleted,
        };
      }),
    );
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
