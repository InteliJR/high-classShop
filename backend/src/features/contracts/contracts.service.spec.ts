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

  it('valor de proposta gera resto fracionário: soma exata (sem drift de centavos)', async () => {
    // proposalValue=333.33 com 10%/10%/30% é o caso que quebrava antes do fix:
    // platform=33.33, office=33.33, total=99.999→100.00, resto ingênuo dava 99.99.
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: 'c1' },
      car: { valor: 333.33 },
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
      commission_rate: 10,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 30);

    expect(result.platformValue).toBe(33.33);
    expect(result.officeValue).toBe(33.33);
    expect(result.specialistValue).toBe(33.34);
    expect(
      result.platformValue + result.officeValue + result.specialistValue,
    ).toBe(100);
  });

  it('total exatamente no limite de ponto flutuante (1.00 + 1.03) não rejeita por erro de arredondamento', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: 'c1' },
      car: { valor: 10000 },
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
      commission_rate: 1.03,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(1));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 2.03);

    expect(result.specialistRate).toBe(0);
  });

  it('processo sem proposta aceita e sem produto → BadRequestException (não gera comissão zerada silenciosa)', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      car: null,
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      (svc as any).resolveCommissionFromTotal('p1', 15),
    ).rejects.toThrow(BadRequestException);
  });
});
