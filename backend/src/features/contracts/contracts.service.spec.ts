import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
} from '@prisma/client';
import {
  ContractsService,
  stripContractDocumentFields,
} from './contracts.service';
import { formatBRL, numberToWords } from '../../shared/utils/format.utils';
import { DocuSignService } from '../../providers/docusign/docusign.service';
import { EnvelopeStatus } from '../../providers/docusign/enums/envelope-status.enum';
import { EnvelopeEffectError } from '../../providers/docusign/envelope-effect.error';

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
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }),
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
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        ...prisma,
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      }),
    );
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('other-process'),
      getEnvelopeStatus: jest.fn(),
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

  it('propagates provider cancellation failures to the caller', async () => {
    const process = processFixture();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: 'SPECIALIST',
        }),
      },
    };
    const prisma = mkPrisma({
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const providerFailure = new Error('DocuSign void failed');
    const docusignClient = {
      voidEnvelope: jest.fn().mockRejectedValue(providerFailure),
    } as any;
    const docusign = new DocuSignService(docusignClient);
    jest.spyOn(docusign, 'getEnvelopeProcessId').mockResolvedValue('process-1');
    jest.spyOn(docusign, 'getEnvelopeStatus').mockResolvedValue({
      envelopeId: 'envelope-1',
      status: EnvelopeStatus.CREATED,
      statusDateTime: new Date().toISOString(),
      uri: '/envelopes/envelope-1',
    });
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
    ).rejects.toBe(providerFailure);
  });

  it('does not void an envelope that is already the active sent contract', async () => {
    const process = processFixture({ active_contract_id: 'contract-1' });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: 'SPECIALIST',
        }),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'contract-1',
          provider_id: 'envelope-1',
          provider_status: 'SENT',
        }),
      },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('process-1'),
      getEnvelopeStatus: jest.fn(),
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
    ).rejects.toThrow(ConflictException);
    expect(docusign.getEnvelopeStatus).not.toHaveBeenCalled();
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('refuses explicit cancellation when the provider no longer reports a draft', async () => {
    const process = processFixture();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: 'SPECIALIST',
        }),
      },
      contract: { findUnique: jest.fn() },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('process-1'),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.SENT,
      }),
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
    ).rejects.toMatchObject({
      response: { error: 'ENVELOPE_NOT_IN_DRAFT' },
    });
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('treats an already voided preview as an idempotent cancellation success', async () => {
    const process = processFixture();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: 'SPECIALIST',
        }),
      },
      contract: { findUnique: jest.fn() },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('process-1'),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.VOIDED,
      }),
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
    ).resolves.toBeUndefined();
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });
});

describe('ContractsService — locked transaction and compensation', () => {
  it('runs the operation with the transaction client that owns the advisory lock', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue({ id: 'process-1' }) },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const service = mkSvc(prisma, mkPlatformCompanyService(10));

    await expect(
      (service as any).withContractProcessLock(
        'process-1',
        async (lockedClient: any) =>
          lockedClient.process.findUnique({ where: { id: 'process-1' } }),
      ),
    ).resolves.toEqual({ id: 'process-1' });
    expect(tx.process.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-reads the active contract under the lock and never voids its persisted envelope', async () => {
    const persistenceFailure = new Error('raw persistence failure');
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ active_contract_id: 'contract-active' }),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({ provider_id: 'envelope-1' }),
      },
    };
    const docusign = {
      getEnvelopeStatus: jest.fn(),
      voidDraftEnvelope: jest.fn(),
    } as any;
    const service = new ContractsService(
      mkPrisma({
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      }),
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );

    await expect(
      (service as any).compensateExternalEnvelope(
        'envelope-1',
        'process-1',
        'compensate',
        persistenceFailure,
      ),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED' },
      },
    });
    expect(docusign.getEnvelopeStatus).not.toHaveBeenCalled();
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('compensates a draft registered before provider preparation fails', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest.fn().mockResolvedValue({ active_contract_id: null }),
      },
      contract: { findUnique: jest.fn() },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const providerFailure = new Error('raw docgen failure');
    const docusign = {
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-partial',
        status: EnvelopeStatus.CREATED,
      }),
      voidDraftEnvelope: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    jest
      .spyOn(service as any, 'generateContractLocked')
      .mockImplementation(async (...args: any[]) => {
        args[3]('envelope-partial', 'DRAFT_CONFIRMED');
        throw new EnvelopeEffectError(
          'envelope-partial',
          'DRAFT_CONFIRMED',
          providerFailure,
        );
      });

    await expect(
      service.generateContract(
        { process_id: 'process-1' } as any,
        'specialist-1',
      ),
    ).rejects.toBeInstanceOf(EnvelopeEffectError);
    expect(docusign.voidDraftEnvelope).toHaveBeenCalledWith(
      'envelope-partial',
      'Falha ao persistir a geração do contrato',
    );
  });

  it('never compensates an envelope whose send result is indeterminate', async () => {
    const prisma = mkPrisma();
    const providerFailure = new Error('raw send failure');
    const docusign = { voidDraftEnvelope: jest.fn() } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    jest
      .spyOn(service as any, 'sendContractAfterPreviewLocked')
      .mockRejectedValue(
        new EnvelopeEffectError(
          'envelope-1',
          'SEND_INDETERMINATE',
          providerFailure,
        ),
      );

    await expect(
      service.sendContractAfterPreview(
        'envelope-1',
        { process_id: 'process-1' } as any,
        'specialist-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED' },
      },
    });
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('redacts raw database/provider errors from reconciliation responses and logs', async () => {
    const persistenceFailure = new Error('database commit failed');
    const compensationFailure = new Error('provider void failed');
    const docusign = {
      voidDraftEnvelope: jest.fn().mockRejectedValue(compensationFailure),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.CREATED,
      }),
    } as any;
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest.fn().mockResolvedValue({ active_contract_id: null }),
      },
      contract: { findUnique: jest.fn() },
    };
    const service = new ContractsService(
      mkPrisma({
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      }),
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    const loggerError = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation();

    await expect(
      (service as any).compensateExternalEnvelope(
        'envelope-1',
        'process-1',
        'Falha ao persistir contrato',
        persistenceFailure,
      ),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: expect.objectContaining({
            process_id: 'process-1',
            envelope_id: 'envelope-1',
            correlation_id: expect.any(String),
          }),
        },
      },
    });
    const response = await (async () => {
      try {
        await (service as any).compensateExternalEnvelope(
          'envelope-1',
          'process-1',
          'Falha ao persistir contrato',
          persistenceFailure,
        );
      } catch (error) {
        return (error as InternalServerErrorException).getResponse();
      }
    })();
    expect(JSON.stringify(response)).not.toContain('database commit failed');
    expect(JSON.stringify(response)).not.toContain('provider void failed');
    expect(loggerError).toHaveBeenCalledWith(
      'Falha na compensação externa; reconciliação manual necessária',
      expect.objectContaining({
        processId: 'process-1',
        envelopeId: 'envelope-1',
        persistenceErrorType: 'Error',
        compensationErrorType: 'Error',
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'database commit failed',
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'provider void failed',
    );
  });

  it('treats rejection after the transaction callback completed as an ambiguous commit and never voids', async () => {
    const commitFailure = new Error('database commit failed');
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => {
        await callback({
          $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        });
        throw commitFailure;
      }),
    });
    const docusign = {
      voidDraftEnvelope: jest.fn().mockResolvedValue(undefined),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.SENT,
      }),
    } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    jest
      .spyOn(service as any, 'sendContractAfterPreviewLocked')
      .mockImplementation(async (...args: any[]) => {
        args[4]();
        return {
          id: 'contract-1',
          envelope_id: 'envelope-1',
          process_id: 'process-1',
          status: 'PENDING',
          created_at: new Date().toISOString(),
        };
      });

    await expect(
      service.sendContractAfterPreview(
        'envelope-1',
        { process_id: 'process-1' } as any,
        'specialist-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: {
            process_id: 'process-1',
            envelope_id: 'envelope-1',
            correlation_id: expect.any(String),
          },
        },
      },
    });
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('surfaces safe manual reconciliation through the public send path after an ambiguous commit', async () => {
    const commitFailure = new Error('database commit failed');
    const compensationFailure = new Error('provider void failed');
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => {
        await callback({
          $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        });
        throw commitFailure;
      }),
    });
    const docusign = {
      voidDraftEnvelope: jest.fn().mockRejectedValue(compensationFailure),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.SENT,
      }),
    } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    jest
      .spyOn(service as any, 'sendContractAfterPreviewLocked')
      .mockImplementation(async (...args: any[]) => {
        args[4]();
        return {
          id: 'contract-1',
          envelope_id: 'envelope-1',
          process_id: 'process-1',
          status: 'PENDING',
          created_at: new Date().toISOString(),
        };
      });

    await expect(
      service.sendContractAfterPreview(
        'envelope-1',
        { process_id: 'process-1' } as any,
        'specialist-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: expect.objectContaining({
            process_id: 'process-1',
            envelope_id: 'envelope-1',
            correlation_id: expect.any(String),
          }),
        },
      },
    });
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });
});

describe('ContractsService — send after preview integrity', () => {
  function makeSendHarness(processOverrides: Record<string, any> = {}) {
    const process = processFixture(processOverrides);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest.fn().mockResolvedValue(process),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: any) =>
            Promise.resolve(
              where.id
                ? { id: where.id, role: 'SPECIALIST' }
                : { id: 'buyer-1' },
            ),
          ),
      },
      contract: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'contract-new',
          process_id: 'process-1',
          created_at: new Date('2026-09-04T12:00:00.000Z'),
        }),
      },
      processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      company: { findUnique: jest.fn() },
    };
    const prisma = mkPrisma({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue('process-1'),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.CREATED,
      }),
      sendDraftEnvelope: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: EnvelopeStatus.SENT,
      }),
      voidDraftEnvelope: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ContractsService(
      prisma,
      docusign,
      {
        sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined),
      } as any,
      mkPlatformCompanyService(10),
    );
    jest.spyOn(service as any, 'resolveCommissionFromTotal').mockResolvedValue({
      platformValue: 1000,
      platformRate: 1,
      officeValue: 0,
      officeRate: 0,
      specialistValue: 9000,
      specialistRate: 9,
    });
    const dto = {
      operation_id: '11111111-1111-4111-8111-111111111111',
      process_id: 'process-1',
      template_id: 'template-1',
      seller_name: 'Seller',
      seller_email: 'seller@example.test',
      buyer_name: 'Buyer',
      buyer_email: 'buyer@example.test',
      vehicle_model: 'Model',
      vehicle_year: '2026',
      vehicle_price: 100000,
      payment_seller_value: 90000,
      total_commission_rate: 10,
      platform_name: 'Platform',
      specialist_name: 'Specialist',
      specialist_email: 'specialist@example.test',
      city: 'Sao Paulo',
    } as any;
    return { service, docusign, tx, dto };
  }

  it('voids a stale draft only after authorization, binding and provider inspection', async () => {
    const { service, docusign, tx, dto } = makeSendHarness({
      status: ProcessStatus.COMPLETED,
    });

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(docusign.sendDraftEnvelope).not.toHaveBeenCalled();
    expect(docusign.getEnvelopeProcessId).toHaveBeenCalledWith('envelope-1');
    expect(docusign.getEnvelopeStatus).toHaveBeenCalledWith('envelope-1');
    expect(docusign.voidDraftEnvelope).toHaveBeenCalledWith(
      'envelope-1',
      expect.any(String),
    );
    expect(tx.contract.create).not.toHaveBeenCalled();
    expect(tx.process.updateMany).not.toHaveBeenCalled();
  });

  it('does not void the winner when duplicate send uses the active envelope', async () => {
    const { service, docusign, tx, dto } = makeSendHarness({
      active_contract_id: 'contract-active',
    });
    tx.contract.findUnique.mockResolvedValue({
      id: 'contract-active',
      provider_id: 'envelope-1',
      provider_status: 'SENT',
    });

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toMatchObject({
      response: { error: 'CONTRACT_ALREADY_EXISTS' },
    });
    expect(docusign.sendDraftEnvelope).not.toHaveBeenCalled();
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('requires reconciliation for a sent losing envelope while another contract is active', async () => {
    const { service, docusign, tx, dto } = makeSendHarness({
      active_contract_id: 'contract-active',
    });
    tx.contract.findUnique.mockResolvedValue({
      id: 'contract-active',
      provider_id: 'envelope-winner',
      provider_status: 'SENT',
    });
    docusign.getEnvelopeStatus.mockResolvedValue({
      envelopeId: 'envelope-1',
      status: EnvelopeStatus.SENT,
    });

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: expect.objectContaining({
            process_id: 'process-1',
            envelope_id: 'envelope-1',
            correlation_id: expect.any(String),
          }),
        },
      },
    });
    expect(docusign.getEnvelopeStatus).toHaveBeenCalledWith('envelope-1');
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('registers a preflight SENT effect before later validation fails', async () => {
    const { service, docusign, tx, dto } = makeSendHarness();
    docusign.getEnvelopeStatus.mockResolvedValue({
      envelopeId: 'envelope-1',
      status: EnvelopeStatus.SENT,
    });
    jest
      .spyOn(service as any, 'resolveCommissionFromTotal')
      .mockRejectedValue(new Error('late validation failed'));

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED' },
      },
    });
    expect(tx.contract.create).not.toHaveBeenCalled();
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it('retains a known SENT effect when the provider status check inside send fails', async () => {
    const { service, docusign, dto } = makeSendHarness();
    docusign.getEnvelopeStatus.mockResolvedValue({
      envelopeId: 'envelope-1',
      status: EnvelopeStatus.SENT,
    });
    docusign.sendDraftEnvelope.mockRejectedValue(
      new Error('second status query failed'),
    );

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED' },
      },
    });
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  });

  it.each([
    [
      EnvelopeStatus.DELIVERED,
      'DELIVERED',
      'PENDING',
      ProcessStatus.DOCUMENTATION,
    ],
    [EnvelopeStatus.COMPLETED, 'COMPLETED', 'SIGNED', ProcessStatus.COMPLETED],
  ] as const)(
    'persists %s without downgrading provider, contract or process state',
    async (
      providerStatus,
      persistedProviderStatus,
      contractStatus,
      processStatus,
    ) => {
      const { service, docusign, tx, dto } = makeSendHarness();
      docusign.getEnvelopeStatus.mockResolvedValue({
        envelopeId: 'envelope-1',
        status: providerStatus,
      });
      docusign.sendDraftEnvelope.mockResolvedValue({
        envelopeId: 'envelope-1',
        status: providerStatus,
      });

      await service.sendContractAfterPreview('envelope-1', dto, 'specialist-1');

      expect(tx.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider_status: persistedProviderStatus,
            status: contractStatus,
            ...(providerStatus === EnvelopeStatus.COMPLETED
              ? { signed_at: expect.any(Date) }
              : {}),
          }),
        }),
      );
      expect(tx.process.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: processStatus }),
        }),
      );
      if (providerStatus === EnvelopeStatus.COMPLETED) {
        expect(tx.processStatusHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            processId: 'process-1',
            status: ProcessStatus.COMPLETED,
            reason: 'CONTRACT_SIGNED',
          }),
        });
      }
    },
  );

  it('requires reconciliation and retains envelope context when stale draft void fails', async () => {
    const { service, docusign, tx, dto } = makeSendHarness({
      status: ProcessStatus.COMPLETED,
    });
    docusign.voidDraftEnvelope.mockRejectedValue(
      new Error('provider void response lost'),
    );

    await expect(
      service.sendContractAfterPreview('envelope-1', dto, 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: expect.objectContaining({
            process_id: 'process-1',
            envelope_id: 'envelope-1',
          }),
        },
      },
    });
    expect(tx.contract.create).not.toHaveBeenCalled();
  });
});

describe('ContractsService — provider operation id', () => {
  it('passes the same public operation_id through to DocuSign preview retries', async () => {
    const process = processFixture();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: 'SPECIALIST',
        }),
      },
      contract: { findUnique: jest.fn() },
      company: { findUnique: jest.fn() },
    };
    const docusign = {
      createEnvelopePreview: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        previewUrl: 'https://demo.docusign.net/preview',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    } as any;
    const service = new ContractsService(
      mkPrisma({
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      }),
      docusign,
      {} as any,
      mkPlatformCompanyService(10),
    );
    jest.spyOn(service as any, 'resolveCommissionFromTotal').mockResolvedValue({
      platformValue: 1000,
      platformRate: 1,
      officeValue: 0,
      officeRate: 0,
      specialistValue: 9000,
      specialistRate: 9,
    });
    const dto = {
      operation_id: '11111111-1111-4111-8111-111111111111',
      process_id: 'process-1',
      template_id: 'template-1',
      seller_name: 'Seller',
      seller_email: 'seller@example.test',
      buyer_name: 'Buyer',
      buyer_email: 'buyer@example.test',
      total_commission_rate: 10,
      city: 'Sao Paulo',
      return_url: 'https://app.example.test/return',
    } as any;

    await service.previewContract(dto, 'specialist-1');
    await service.previewContract(dto, 'specialist-1');

    expect(docusign.createEnvelopePreview).toHaveBeenCalledTimes(2);
    for (const [params] of docusign.createEnvelopePreview.mock.calls) {
      expect(params.transactionId).toBe(dto.operation_id);
    }
  });

  it('returns a stable compensated code so the caller can rotate the operation id', async () => {
    const service = mkSvc(mkPrisma(), mkPlatformCompanyService(10));
    jest
      .spyOn(service as any, 'withContractProcessLock')
      .mockImplementation(async (_processId: string, operation: any) =>
        operation({}),
      );
    jest
      .spyOn(service as any, 'previewContractLocked')
      .mockRejectedValue(
        new EnvelopeEffectError(
          'envelope-compensated',
          'DRAFT_CONFIRMED',
          new Error('docgen failed'),
        ),
      );
    const compensate = jest
      .spyOn(service as any, 'compensateExternalEnvelope')
      .mockResolvedValue(undefined);

    await expect(
      service.previewContract(
        {
          process_id: 'process-1',
          operation_id: '11111111-1111-4111-8111-111111111111',
        } as any,
        'specialist-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 'CONTRACT_PREVIEW_COMPENSATED',
          details: {
            process_id: 'process-1',
            operation_id: '11111111-1111-4111-8111-111111111111',
          },
        },
      },
    });
    expect(compensate).toHaveBeenCalledWith(
      'envelope-compensated',
      'process-1',
      expect.any(String),
      expect.any(Error),
      'DRAFT_CONFIRMED',
    );
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
      client: {
        consultant: { company_id: 'consultantCo' },
        company_id: 'directCo',
      },
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
