import { DashboardService } from './dashboard.service';

function mkPrisma() {
  return {
    company: { count: jest.fn().mockResolvedValue(0) },
    process: { count: jest.fn().mockResolvedValue(0) },
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    car: { count: jest.fn().mockResolvedValue(0) },
    boat: { count: jest.fn().mockResolvedValue(0) },
    aircraft: { count: jest.fn().mockResolvedValue(0) },
  } as any;
}

function mkCommissionsService(sales: any[] = []) {
  return { listSales: jest.fn().mockResolvedValue(sales) } as any;
}

function mkAdminDatabaseService(counts: any[] = []) {
  return { countAll: jest.fn().mockResolvedValue(counts) } as any;
}

function mkSvc(sales: any[] = [], counts: any[] = []) {
  return new DashboardService(
    mkPrisma(),
    mkCommissionsService(sales),
    mkAdminDatabaseService(counts),
  );
}

describe('DashboardService — getAdminStats sem conversionRate', () => {
  it('não retorna mais o campo conversionRate', async () => {
    const result = await mkSvc().getAdminStats();
    expect(result).not.toHaveProperty('conversionRate');
  });
});

describe('DashboardService — commissionSummary', () => {
  it('soma totalPaid e calcula ticket médio corretamente', async () => {
    const sales = [
      { totalCommission: 1000, signedAt: new Date('2020-01-15') },
      { totalCommission: 2000, signedAt: new Date('2020-01-20') },
    ];
    const result = await mkSvc(sales).getAdminStats();
    expect(result.commissionSummary.totalPaid).toBe(3000);
    expect(result.commissionSummary.avgTicket).toBe(1500);
  });

  it('thisMonth soma só vendas assinadas no mês corrente', async () => {
    const now = new Date();
    const thisMonthSale = { totalCommission: 500, signedAt: now };
    const oldSale = {
      totalCommission: 9999,
      signedAt: new Date(now.getFullYear() - 1, 0, 1),
    };
    const result = await mkSvc([thisMonthSale, oldSale]).getAdminStats();
    expect(result.commissionSummary.thisMonth).toBe(500);
  });

  it('avgTicket e totalPaid são 0 quando não há vendas', async () => {
    const result = await mkSvc([]).getAdminStats();
    expect(result.commissionSummary.avgTicket).toBe(0);
    expect(result.commissionSummary.totalPaid).toBe(0);
  });

  it('recentSales limita a 5, preservando a ordem recebida', async () => {
    const sales = Array.from({ length: 8 }, (_, i) => ({
      totalCommission: i,
      signedAt: new Date(),
    }));
    const result = await mkSvc(sales).getAdminStats();
    expect(result.commissionSummary.recentSales).toHaveLength(5);
    expect(result.commissionSummary.recentSales[0].totalCommission).toBe(0);
  });
});

describe('DashboardService — databaseCounts', () => {
  it('repassa o retorno do AdminDatabaseService sem transformar', async () => {
    const counts = [{ key: 'users', label: 'Usuários', count: 42 }];
    const result = await mkSvc([], counts).getAdminStats();
    expect(result.databaseCounts).toEqual(counts);
  });
});
