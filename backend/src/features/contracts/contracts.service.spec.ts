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
  it('aplica o escritório sobre o restante da fatia do especialista', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 70, company_id: null },
      client: { consultant: { company_id: 'c1' }, company_id: null },
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
      commission_rate: 40,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 10);

    // Produto 100.000 × 10% = bolo 10.000.
    // Especialista recebe 70% do bolo (7.000); escritório recebe 40% do
    // restante (3.000), e a plataforma recebe o resíduo (1.800).
    expect(result.specialistValue).toBe(7000);
    expect(result.officeValue).toBe(1200);
    expect(result.platformValue).toBe(1800);
    expect(result.specialistRate).toBe(7);
    expect(result.officeRate).toBe(1.2);
    expect(result.platformRate).toBe(1.8);
  });

  it('sem escritório, destina todo o restante à plataforma', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 70, company_id: null },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 10);

    expect(result.specialistValue).toBe(7000);
    expect(result.officeValue).toBe(0);
    expect(result.platformValue).toBe(3000);
  });

  it('não usa a taxa configurada da plataforma como corte direto do produto', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 50, company_id: null },
      client: { consultant: { company_id: 'c1' }, company_id: null },
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
      commission_rate: 25,
      platform_commission_rate: 5,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 10);

    // A plataforma é o resíduo: 10.000 − 5.000 − 25% de 5.000 = 3.750.
    expect(result.specialistValue).toBe(5000);
    expect(result.officeValue).toBe(1250);
    expect(result.platformValue).toBe(3750);
  });

  it('aceita comissão total menor que taxas legadas de plataforma/escritório', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 0, company_id: null },
      client: { consultant: { company_id: 'c1' }, company_id: null },
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

    const result = await (svc as any).resolveCommissionFromTotal('p1', 1);

    expect(result.officeValue).toBe(80);
    expect(result.platformValue).toBe(920);
  });

  it('valor de proposta gera resto fracionário: soma exata (sem drift de centavos)', async () => {
    // proposalValue=333.33; bolo=100.00. O especialista recebe 10% do bolo
    // e o escritório 30% do restante, com a plataforma absorvendo o centavo.
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 10, company_id: null },
      client: { consultant: { company_id: 'c1' }, company_id: null },
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
      commission_rate: 30,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 30);

    expect(result.specialistValue).toBe(10);
    expect(result.officeValue).toBe(27);
    expect(result.platformValue).toBe(63);
    expect(
      result.platformValue + result.officeValue + result.specialistValue,
    ).toBe(100);
  });

  it('mantém a soma exata com taxas decimais', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 33.33, company_id: null },
      client: { consultant: { company_id: 'c1' }, company_id: null },
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

    expect(
      Math.round(
        (result.platformValue + result.officeValue + result.specialistValue) *
          100,
      ) / 100,
    ).toBe(203);
  });

  it('processo sem proposta aceita e sem produto → BadRequestException (não gera comissão zerada silenciosa)', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: 50, company_id: null },
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
      specialist: { id: 's1', commission_rate: 50, company_id: null },
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
    // bolo = 100000 * 20% = 20000; restante = 10000 (especialista recebe 50%);
    // officeValue = 10000 * 8% = 800 → efetivo = 800/100000*100 = 0.8.
    // O que importa pro fallback é: office != 0 e a company certa foi buscada.
    expect(result.officeRate).toBe(0.8);
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
