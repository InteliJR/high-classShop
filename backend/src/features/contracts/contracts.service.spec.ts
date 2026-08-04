import { BadRequestException } from '@nestjs/common';
import {
  ContractsService,
  stripContractDocumentFields,
} from './contracts.service';
import { formatBRL, numberToWords } from '../../shared/utils/format.utils';

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

  it('escritório com platform_commission_rate própria: sobrepõe a taxa padrão global da plataforma', async () => {
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
      platform_commission_rate: 5,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 20);

    expect(result.platformRate).toBe(5);
    expect(result.officeRate).toBe(8);
    expect(result.specialistRate).toBe(7);
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

  it('cliente vinculado direto ao escritório (sem consultor) gera comissão de escritório', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      client: { consultant: null, company_id: 'c1' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório Whitelabel',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 20);

    // officeRate aqui é a taxa EFETIVA sobre a venda (modelo aninhado):
    // bolo = 100000 * 20% = 20000; restante = 20000 (specialistShareRate=0);
    // officeValue = 20000 * 8% = 1600 → efetivo = 1600/100000*100 = 1.6.
    // O que importa pro fallback é: office != 0 e a company certa foi buscada.
    expect(result.officeRate).toBe(1.6);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
  });

  it('consultor tem prioridade sobre o company_id direto do cliente', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      client: { consultant: { company_id: 'consultantCo' }, company_id: 'directCo' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório do Consultor',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    await (svc as any).resolveCommissionFromTotal('p1', 20);

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'consultantCo' },
    });
  });
});

describe('ContractsService — buildFormFields zera comissão no DocuSign', () => {
  const dto: any = {
    seller_name: 'Vendedor',
    seller_cpf: '12345678901',
    seller_address: 'Rua 1',
    seller_cep: '01234567',
    seller_bank: 'Itau',
    seller_agency: '1',
    seller_checking_account: '2',
    buyer_name: 'Comprador',
    buyer_cpf: '98765432100',
    buyer_address: 'Rua 2',
    buyer_cep: '01234000',
    vehicle_model: 'Carro X',
    vehicle_year: '2020',
    vehicle_registration_id: 'ABC1234',
    vehicle_serial_number: 'CHASSI',
    vehicle_price: 100000,
    payment_seller_value: 90000,
    total_commission_rate: 10,
    platform_value: 4000,
    platform_percentage: 4,
    platform_name: 'Plat',
    platform_cnpj: '11111111000111',
    platform_bank: 'B',
    platform_agency: 'A',
    platform_checking_account: 'C',
    office_value: 2000,
    office_name: 'Escr',
    office_cnpj: '22222222000122',
    specialist_value: 4000,
    specialist_name: 'Esp',
    specialist_email: 'e@e.com',
    specialist_document: '33333333000133',
    city: 'São Paulo',
  };

  it('valores monetários de comissão vão zerados; dados das partes intactos', () => {
    const svc = new ContractsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const fields = (svc as any).buildFormFields(dto, 'CAR');

    // comissão zerada (split + flat legado)
    expect(fields.platform_value).toBe(formatBRL(0));
    expect(fields.platform_value_written).toBe(numberToWords(0));
    expect(fields.platform_percentage).toBe('0');
    expect(fields.commission_office_value).toBe(formatBRL(0));
    expect(fields.commission_office_written).toBe(numberToWords(0));
    expect(fields.specialist_value).toBe(formatBRL(0));
    expect(fields.specialist_value_written).toBe(numberToWords(0));
    expect(fields.commission_value).toBe(formatBRL(0));
    expect(fields.commision_value_written).toBe(numberToWords(0));

    // dados que NÃO são comissão seguem normais
    expect(fields.buyer_name).toBe('Comprador');
    expect(fields.vehicle_model).toBe('Carro X');
    expect(fields.platform_name).toBe('Plat');
  });
});

describe('stripContractDocumentFields', () => {
  it('remove pontuação de todos os campos de documento e CEP', () => {
    const result = stripContractDocumentFields({
      seller_cpf: '123.456.789-00',
      seller_rg: '12.345.678-9',
      seller_cep: '01234-567',
      buyer_cpf: '987.654.321-00',
      buyer_rg: undefined,
      buyer_cep: '09876-543',
      platform_cnpj: '12.345.678/0001-99',
      office_cnpj: '98.765.432/0001-11',
      specialist_document: '11.222.333/0001-44',
      testimonial1_cpf: '111.222.333-44',
      testimonial2_cpf: undefined,
    });

    expect(result).toEqual({
      seller_cpf: '12345678900',
      seller_rg: '123456789',
      seller_cep: '01234567',
      buyer_cpf: '98765432100',
      buyer_rg: undefined,
      buyer_cep: '09876543',
      platform_cnpj: '12345678000199',
      office_cnpj: '98765432000111',
      specialist_document: '11222333000144',
      testimonial1_cpf: '11122233344',
      testimonial2_cpf: undefined,
    });
  });

  it('mantém undefined como undefined (não vira string vazia)', () => {
    const result = stripContractDocumentFields({
      seller_cpf: '12345678900',
      seller_rg: undefined,
      seller_cep: '01234567',
      buyer_cpf: '98765432100',
      buyer_rg: undefined,
      buyer_cep: '09876543',
      platform_cnpj: undefined,
      office_cnpj: undefined,
      specialist_document: undefined,
      testimonial1_cpf: undefined,
      testimonial2_cpf: undefined,
    });

    expect(result.platform_cnpj).toBeUndefined();
    expect(result.testimonial1_cpf).toBeUndefined();
  });
});
