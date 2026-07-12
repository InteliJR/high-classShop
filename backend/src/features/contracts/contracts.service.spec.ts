import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

function mkPrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    process: {
      findUnique: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    ...overrides,
  } as any;
}

function mkPlatformCompanyService(defaultRate = 10) {
  return {
    findOne: jest
      .fn()
      .mockResolvedValue({ default_commission_rate: defaultRate }),
  } as any;
}

function mkSvc(prisma: any, platformCompanyService: any) {
  return new ContractsService(
    prisma,
    {} as any,
    {} as any,
    platformCompanyService,
  );
}

describe('ContractsService — resolveCommissionFromTotal', () => {
  it('especialista sem escritório: corte = total - plataforma', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 15);

    expect(result.platformRate).toBe(10);
    expect(result.officeRate).toBe(0);
    expect(result.specialistRate).toBe(5);
    expect(result.platformValue).toBeCloseTo(10000);
    expect(result.officeValue).toBe(0);
    expect(result.specialistValue).toBeCloseTo(5000);
    // os 3 valores somam exatamente o valor total (sem drift de arredondamento)
    const totalValue = (100000 * 15) / 100;
    expect(
      result.platformValue + result.officeValue + result.specialistValue,
    ).toBeCloseTo(totalValue);
  });

  it('especialista com escritório: trava taxa do escritório também', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: 'c1' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório X',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 20);

    expect(result.platformRate).toBe(10);
    expect(result.officeRate).toBe(8);
    expect(result.specialistRate).toBe(2);
  });

  it('total menor que plataforma + escritório → BadRequestException', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: 'c1' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório X',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      (svc as any).resolveCommissionFromTotal('p1', 15),
    ).rejects.toThrow(BadRequestException);
  });
});
