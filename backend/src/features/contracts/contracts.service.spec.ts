import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';
import {
  ContractsService,
  stripContractDocumentFields,
} from './contracts.service';
import { formatBRL, numberToWords } from '../../shared/utils/format.utils';

function mkPrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'specialist-1',
        role: 'SPECIALIST',
      }),
    },
    process: {
      findUnique: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({ $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]) }),
    ),
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

const carFixture = {
  id: 'car-1',
  marca: 'Marca',
  modelo: 'Modelo',
  ano: 2025,
  valor: new Prisma.Decimal('999999.00'),
  currency: ProductCurrency.BRL,
  cor: 'Preto',
  combustivel: 'Gasolina',
  km: 100,
};

function processFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'process-1',
    specialist_id: 'specialist-1',
    status: 'DOCUMENTATION',
    active_contract_id: null,
    product_type: ProductType.CAR,
    negotiation_currency: ProductCurrency.BRL,
    negotiation_product_value: new Prisma.Decimal('100000.00'),
    client: {
      id: 'client-1',
      name: 'Cliente',
      surname: 'Teste',
      email: 'cliente@example.com',
      cpf: null,
      rg: null,
      address: null,
      consultant: null,
      company_id: null,
    },
    specialist: {
      id: 'specialist-1',
      name: 'Especialista',
      surname: 'Teste',
      email: 'especialista@example.com',
      cpf: null,
      company_id: null,
      commission_rate: 0,
      bank: null,
      agency: null,
      checking_account: null,
      address: null,
    },
    car: carFixture,
    boat: null,
    aircraft: null,
    accepted_proposal: null,
    ...overrides,
  };
}

describe('ContractsService — prefillContract', () => {
  it('rejects an unrelated specialist before returning contract PII', async () => {
    const prisma = mkPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'other-specialist',
          role: 'SPECIALIST',
        }),
      },
    });
    prisma.process.findUnique.mockResolvedValue(processFixture());
    const service = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      service.prefillContract('process-1', 'other-specialist'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an administrator to load the contract prefill', async () => {
    const prisma = mkPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }),
      },
    });
    prisma.process.findUnique.mockResolvedValue(processFixture());
    const service = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      service.prefillContract('process-1', 'admin-1'),
    ).resolves.toMatchObject({ process_id: 'process-1' });
  });

  it('prefills price and currency from the process snapshot', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: new Prisma.Decimal('120000.00'),
        car: {
          ...carFixture,
          valor: new Prisma.Decimal('999999.00'),
          currency: ProductCurrency.BRL,
        },
      }),
    );
    const service = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await service.prefillContract('process-1', 'specialist-1');
    const commission = await (service as any).resolveCommissionFromTotal(
      'process-1',
      10,
    );

    expect(commission.platformValue).toBe(12000);
    expect(result.currency).toBe(ProductCurrency.USD);
    expect(result.product.price).toBe(120000);
  });

  it('rejects contract prefill without a negotiation snapshot', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: null,
        negotiation_product_value: null,
      }),
    );
    const service = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      service.prefillContract('process-1', 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' },
      },
    });
  });
});

describe('ContractsService — cancelPreview authorization', () => {
  it('does not cancel an envelope bound to another process', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue(processFixture());
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('other-process'),
      voidDraftEnvelope: jest.fn(),
    } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );

    await expect(
      service.cancelPreview(
        'envelope-1',
        'process-1',
        'specialist-1',
        'cancel',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });
});

describe('ContractsService — resolveCommissionFromTotal', () => {
  it('mantém a proposta aceita como valor final quando ela existe', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000'),
      specialist: { id: 's1', commission_rate: 0, company_id: null },
      client: { consultant: null, company_id: null },
      car: { valor: new Prisma.Decimal('999999') },
      boat: null,
      aircraft: null,
      accepted_proposal: {
        proposed_value: new Prisma.Decimal('80000'),
      },
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 10);

    expect(result.platformValue).toBe(8000);
  });

  it('aplica o escritório sobre a comissão total', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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
      commission_rate: 20,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 10);

    // Produto 100.000 × 10% = bolo 10.000.
    // Especialista recebe 70% do bolo (7.000); escritório recebe 20% dele
    // (2.000), e a plataforma recebe o saldo (1.000).
    expect(result.specialistValue).toBe(7000);
    expect(result.officeValue).toBe(2000);
    expect(result.platformValue).toBe(1000);
    expect(result.specialistRate).toBe(7);
    expect(result.officeRate).toBe(2);
    expect(result.platformRate).toBe(1);
  });

  it('sem escritório, destina todo o saldo à plataforma', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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

  it('rejeita taxas de especialista e escritório que ultrapassam a comissão total', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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

    await expect(
      (svc as any).resolveCommissionFromTotal('p1', 10),
    ).rejects.toThrow(
      'A soma das taxas do especialista e do escritório não pode ultrapassar 100% da comissão total.',
    );
  });

  it('não usa a taxa configurada da plataforma como corte direto do produto', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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

    // A plataforma é o resíduo: 10.000 − 5.000 − 25% de 10.000 = 2.500.
    expect(result.specialistValue).toBe(5000);
    expect(result.officeValue).toBe(2500);
    expect(result.platformValue).toBe(2500);
  });

  it('aceita comissão total menor que taxas legadas de plataforma/escritório', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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
    // proposalValue=333.33; bolo=100.00. O especialista recebe 10% e o
    // escritório 30% do bolo, com a plataforma absorvendo o resíduo.
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('333.33'),
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
    expect(result.officeValue).toBe(30);
    expect(result.platformValue).toBe(60);
    expect(
      result.platformValue + result.officeValue + result.specialistValue,
    ).toBe(100);
  });

  it('mantém a soma exata com taxas decimais', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('10000'),
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
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('0'),
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
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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

    // officeRate aqui é a taxa EFETIVA sobre a venda:
    // bolo = 100000 * 20% = 20000; officeValue = 20000 * 8% = 1600
    // → efetivo = 1600/100000*100 = 1.6.
    // O que importa pro fallback é: office != 0 e a company certa foi buscada.
    expect(result.officeRate).toBe(1.6);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
  });

  it('consultor tem prioridade sobre o company_id direto do cliente', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('100000'),
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
