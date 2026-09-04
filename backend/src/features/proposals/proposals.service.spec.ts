import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  ProposalStatus,
  UserRole,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';

const now = new Date('2026-01-01T00:00:00.000Z');

function processFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'process-1',
    status: ProcessStatus.NEGOTIATION,
    product_type: ProductType.CAR,
    client_id: 'client-1',
    specialist_id: 'specialist-1',
    negotiation_currency: ProductCurrency.BRL,
    negotiation_product_value: new Prisma.Decimal('100000.00'),
    client: {
      id: 'client-1',
      email: 'client@example.com',
      name: 'Client',
      surname: 'One',
      role: UserRole.CLIENT,
      consultant_id: null,
    },
    specialist: {
      id: 'specialist-1',
      email: 'specialist@example.com',
      name: 'Specialist',
      surname: 'One',
      role: UserRole.SPECIALIST,
    },
    car: {
      id: 'car-1',
      valor: new Prisma.Decimal('100000.00'),
      currency: ProductCurrency.BRL,
      marca: 'Brand',
      modelo: 'Model',
      is_active: true,
    },
    boat: null,
    aircraft: null,
    accepted_proposal: null,
    proposals: [],
    ...overrides,
  };
}

function proposalFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    process_id: 'process-1',
    proposed_by_id: 'client-1',
    proposed_to_id: 'specialist-1',
    proposed_value: new Prisma.Decimal('80000.00'),
    status: ProposalStatus.PENDING,
    message: null,
    counter_to_id: null,
    created_at: now,
    updated_at: now,
    proposed_by: {
      id: 'client-1',
      email: 'client@example.com',
      name: 'Client',
      surname: 'One',
      role: UserRole.CLIENT,
    },
    proposed_to: {
      id: 'specialist-1',
      email: 'specialist@example.com',
      name: 'Specialist',
      surname: 'One',
      role: UserRole.SPECIALIST,
    },
    ...overrides,
  };
}

function setup() {
  let claimedStatus = ProposalStatus.ACCEPTED;
  const transactionProposalCreate = jest
    .fn()
    .mockImplementation(({ data }) =>
      Promise.resolve(proposalFixture({ ...data })),
    );
  const proposalFindUnique = jest.fn();
  const transactionProposalUpdateMany = jest
    .fn()
    .mockImplementation(({ data }) => {
      claimedStatus = data.status;
      return Promise.resolve({ count: 1 });
    });
  const transactionProposalFindUniqueOrThrow = jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(proposalFixture({ status: claimedStatus })),
    );
  const transactionProcessUpdateMany = jest
    .fn()
    .mockResolvedValue({ count: 1 });
  const processFindUnique = jest.fn();
  const transactionProcessFindUnique = jest
    .fn()
    .mockImplementation((args) => processFindUnique(args));
  const prisma = {
    process: {
      findUnique: processFindUnique,
    },
    negotiationProposal: {
      findUnique: proposalFindUnique,
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback) =>
      callback({
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        negotiationProposal: {
          create: transactionProposalCreate,
          findUnique: proposalFindUnique,
          findUniqueOrThrow: transactionProposalFindUniqueOrThrow,
          updateMany: transactionProposalUpdateMany,
        },
        process: {
          findUnique: transactionProcessFindUnique,
          updateMany: transactionProcessUpdateMany,
        },
        processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      }),
    ),
  } as any;
  const settings = {
    isMinimumProposalEnabled: jest.fn().mockResolvedValue(true),
    getMinimumProposalPercentage: jest.fn().mockResolvedValue(0.8),
  } as any;
  const notifications = {
    sendProposalReceivedEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalAcceptedEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalRejectedEmail: jest.fn().mockResolvedValue(undefined),
    sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
  const service = new ProposalsService(prisma, settings, notifications);

  return {
    service,
    prisma,
    settings,
    notifications,
    transactionProposalCreate,
    transactionProposalUpdateMany,
    transactionProcessFindUnique,
    transactionProcessUpdateMany,
  };
}

describe('ProposalsService — snapshot e mínimo dinâmico', () => {
  let immediateSpy: jest.SpyInstance;

  beforeEach(() => {
    immediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(((
      callback: (...args: any[]) => void,
    ) => {
      callback();
      return {} as NodeJS.Immediate;
    }) as typeof setImmediate);
  });

  afterEach(() => {
    immediateSpy.mockRestore();
  });

  it('calcula o mínimo habilitado a partir do snapshot imutável', async () => {
    const { service, prisma, settings } = setup();
    settings.isMinimumProposalEnabled.mockResolvedValue(true);
    settings.getMinimumProposalPercentage.mockResolvedValue(0.8);
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: new Prisma.Decimal('100000.00'),
        car: {
          ...processFixture().car,
          valor: new Prisma.Decimal('999999.00'),
          currency: ProductCurrency.BRL,
        },
      }),
    );

    const response = await service.getByProcess('process-1', 'client-1');

    expect(response.process).toMatchObject({
      product_value: 100000,
      currency: ProductCurrency.USD,
      minimum_enabled: true,
      minimum_value: 80000,
    });
  });

  it('exposes the cent-rounded minimum used by proposal creation', async () => {
    const { service, prisma, settings } = setup();
    settings.getMinimumProposalPercentage.mockResolvedValue(0.8);
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_product_value: new Prisma.Decimal('333.33'),
      }),
    );

    const response = await service.getByProcess('process-1', 'client-1');

    expect(response.process.minimum_value).toBe(266.66);
  });

  it('accepts the exact cent-rounded minimum boundary', async () => {
    const { service, prisma, settings, transactionProposalCreate } = setup();
    settings.getMinimumProposalPercentage.mockResolvedValue(0.8);
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_product_value: new Prisma.Decimal('333.33'),
      }),
    );

    await expect(
      service.create(
        { process_id: 'process-1', proposed_value: 266.66 },
        'client-1',
      ),
    ).resolves.toBeDefined();
    expect(transactionProposalCreate).toHaveBeenCalled();
  });

  it('aceita qualquer proposta positiva e não busca percentual quando o mínimo está desligado', async () => {
    const { service, prisma, settings } = setup();
    settings.isMinimumProposalEnabled.mockResolvedValue(false);
    prisma.process.findUnique.mockResolvedValue(processFixture());

    await expect(
      service.create(
        { process_id: 'process-1', proposed_value: 1 },
        'client-1',
      ),
    ).resolves.toBeDefined();

    expect(settings.getMinimumProposalPercentage).not.toHaveBeenCalled();
  });

  it('lê a configuração novamente em negociação já aberta', async () => {
    const { service, prisma, settings } = setup();
    prisma.process.findUnique.mockResolvedValue(processFixture());
    settings.isMinimumProposalEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const first = await service.getByProcess('process-1', 'client-1');
    const second = await service.getByProcess('process-1', 'client-1');

    expect(first.process.minimum_enabled).toBe(true);
    expect(second.process).toMatchObject({
      minimum_enabled: false,
      minimum_value: null,
    });
    expect(settings.isMinimumProposalEnabled).toHaveBeenCalledTimes(2);
    expect(settings.getMinimumProposalPercentage).toHaveBeenCalledTimes(1);
  });

  it('falha explicitamente quando a negociação com produto não tem snapshot', async () => {
    const { service, prisma } = setup();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: null,
        negotiation_product_value: null,
      }),
    );

    await expect(
      service.getByProcess('process-1', 'client-1'),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' },
      },
    });
  });

  it('falha explicitamente ao enviar proposta sem snapshot', async () => {
    const { service, prisma, settings, transactionProposalCreate } = setup();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: null,
        negotiation_product_value: null,
      }),
    );

    await expect(
      service.create(
        { process_id: 'process-1', proposed_value: 80000 },
        'client-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' },
      },
    });
    expect(settings.isMinimumProposalEnabled).not.toHaveBeenCalled();
    expect(transactionProposalCreate).not.toHaveBeenCalled();
  });

  it.each(['getByProcess', 'create'] as const)(
    'não solicita valor ou moeda mutáveis do produto em %s',
    async (operation) => {
      const { service, prisma, settings } = setup();
      settings.isMinimumProposalEnabled.mockResolvedValue(false);
      prisma.process.findUnique.mockResolvedValue(processFixture());

      if (operation === 'getByProcess') {
        await service.getByProcess('process-1', 'client-1');
      } else {
        await service.create(
          { process_id: 'process-1', proposed_value: 1 },
          'client-1',
        );
      }

      const productIncludes =
        prisma.process.findUnique.mock.calls[0][0].include;
      for (const productType of ['car', 'boat', 'aircraft']) {
        expect(productIncludes[productType].select).not.toHaveProperty('valor');
        expect(productIncludes[productType].select).not.toHaveProperty(
          'currency',
        );
      }
    },
  );

  it('usa snapshot no envio e inclui sua moeda na notificação recebida', async () => {
    const { service, prisma, notifications } = setup();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: new Prisma.Decimal('100000.00'),
        car: {
          ...processFixture().car,
          valor: new Prisma.Decimal('999999.00'),
          currency: ProductCurrency.BRL,
        },
      }),
    );

    await service.create(
      { process_id: 'process-1', proposed_value: 80000 },
      'client-1',
    );

    expect(notifications.sendProposalReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        originalValue: 100000,
        currency: ProductCurrency.USD,
      }),
    );
  });

  it('rejects a counterproposal that references another process', async () => {
    const { service, prisma, transactionProposalCreate } = setup();
    prisma.process.findUnique.mockResolvedValue(processFixture());
    prisma.negotiationProposal.findUnique.mockResolvedValue(
      proposalFixture({
        process_id: 'other-process',
        proposed_to_id: 'specialist-1',
      }),
    );

    await expect(
      service.create(
        {
          process_id: 'process-1',
          proposed_value: 90000,
          counter_to_id: 'proposal-1',
        },
        'specialist-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(transactionProposalCreate).not.toHaveBeenCalled();
  });

  it('rejects a counterproposal when the referenced proposal targets another actor', async () => {
    const { service, prisma, transactionProposalCreate } = setup();
    prisma.process.findUnique.mockResolvedValue(processFixture());
    prisma.negotiationProposal.findUnique.mockResolvedValue(
      proposalFixture({ proposed_to_id: 'someone-else' }),
    );

    await expect(
      service.create(
        {
          process_id: 'process-1',
          proposed_value: 90000,
          counter_to_id: 'proposal-1',
        },
        'specialist-1',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(transactionProposalCreate).not.toHaveBeenCalled();
  });

  it('does not create a counterproposal when the conditional PENDING claim is lost', async () => {
    const {
      service,
      prisma,
      transactionProposalCreate,
      transactionProposalUpdateMany,
    } = setup();
    prisma.process.findUnique.mockResolvedValue(processFixture());
    prisma.negotiationProposal.findUnique.mockResolvedValue(
      proposalFixture({ proposed_to_id: 'specialist-1' }),
    );
    transactionProposalUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.create(
        {
          process_id: 'process-1',
          proposed_value: 90000,
          counter_to_id: 'proposal-1',
        },
        'specialist-1',
      ),
    ).rejects.toThrow(ConflictException);

    expect(transactionProposalCreate).not.toHaveBeenCalled();
  });

  it('re-reads process state inside the lock and cannot create after documentation starts', async () => {
    const {
      service,
      prisma,
      transactionProcessFindUnique,
      transactionProposalCreate,
    } = setup();
    prisma.process.findUnique.mockResolvedValue(
      processFixture({ status: ProcessStatus.NEGOTIATION }),
    );
    transactionProcessFindUnique.mockResolvedValue(
      processFixture({ status: ProcessStatus.DOCUMENTATION }),
    );

    await expect(
      service.create(
        { process_id: 'process-1', proposed_value: 80000 },
        'client-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(transactionProposalCreate).not.toHaveBeenCalled();
    expect(transactionProcessFindUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['accept', 'sendProposalAcceptedEmail', 'acceptedValue'],
    ['reject', 'sendProposalRejectedEmail', 'rejectedValue'],
  ] as const)(
    'inclui a moeda do snapshot ao %s uma proposta',
    async (action, notificationMethod, valueField) => {
      const { service, prisma, notifications } = setup();
      const process = {
        status: ProcessStatus.NEGOTIATION,
        client_id: 'client-1',
        specialist_id: 'specialist-1',
        product_type: ProductType.CAR,
        car_id: 'car-1',
        boat_id: null,
        aircraft_id: null,
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: new Prisma.Decimal('100000.00'),
        client: { consultant_id: null },
      };
      prisma.negotiationProposal.findUnique
        .mockResolvedValueOnce({ process_id: 'process-1' })
        .mockResolvedValueOnce(proposalFixture({ process }))
        .mockResolvedValueOnce(
          proposalFixture({
            process: {
              negotiation_currency: ProductCurrency.USD,
              negotiation_product_value: new Prisma.Decimal('100000.00'),
            },
          }),
        );
      prisma.negotiationProposal.update.mockResolvedValue(
        proposalFixture({ status: ProposalStatus.REJECTED }),
      );
      prisma.process.findUnique.mockResolvedValue(null);

      await service[action]('proposal-1', 'specialist-1');

      expect(
        prisma.negotiationProposal.findUnique.mock.calls[1][0].include.process,
      ).toEqual({
        select: {
          status: true,
          client_id: true,
          specialist_id: true,
          product_type: true,
          car_id: true,
          boat_id: true,
          aircraft_id: true,
          negotiation_currency: true,
          negotiation_product_value: true,
          client: { select: { consultant_id: true } },
        },
      });
      expect(notifications[notificationMethod]).toHaveBeenCalledWith(
        expect.objectContaining({
          [valueField]: 80000,
          currency: ProductCurrency.USD,
        }),
      );
    },
  );

  it.each([
    ['accept', 'sendProposalAcceptedEmail'],
    ['reject', 'sendProposalRejectedEmail'],
  ] as const)(
    'falha explicitamente e não notifica ao %s sem snapshot',
    async (action, notificationMethod) => {
      const {
        service,
        prisma,
        notifications,
        transactionProposalUpdateMany,
        transactionProcessUpdateMany,
      } = setup();
      const process = {
        status: ProcessStatus.NEGOTIATION,
        client_id: 'client-1',
        specialist_id: 'specialist-1',
        product_type: ProductType.CAR,
        car_id: 'car-1',
        boat_id: null,
        aircraft_id: null,
        negotiation_currency: null,
        negotiation_product_value: null,
        client: { consultant_id: null },
      };
      prisma.negotiationProposal.findUnique
        .mockResolvedValueOnce({ process_id: 'process-1' })
        .mockResolvedValueOnce(proposalFixture({ process }))
        .mockResolvedValueOnce(
          proposalFixture({
            process: {
              negotiation_currency: null,
              negotiation_product_value: null,
            },
          }),
        );

      await expect(
        service[action]('proposal-1', 'specialist-1'),
      ).rejects.toMatchObject({
        response: {
          error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' },
        },
      });
      expect(notifications[notificationMethod]).not.toHaveBeenCalled();
      expect(prisma.negotiationProposal.update).not.toHaveBeenCalled();
      expect(transactionProposalUpdateMany).not.toHaveBeenCalled();
      expect(transactionProcessUpdateMany).not.toHaveBeenCalled();
    },
  );

  it('allows only one concurrent accept/reject response and preserves the accepted proposal invariant', async () => {
    const state = {
      proposalStatus: ProposalStatus.PENDING,
      processStatus: ProcessStatus.NEGOTIATION,
      acceptedProposalId: null as string | null,
      historyCount: 0,
    };
    const currentProposal = () =>
      proposalFixture({
        status: state.proposalStatus,
        process: processFixture({
          status: state.processStatus,
          car_id: 'car-1',
          boat_id: null,
          aircraft_id: null,
        }),
      });

    const negotiationProposal = {
      findUnique: jest.fn(async () => currentProposal()),
      findUniqueOrThrow: jest.fn(async () => currentProposal()),
      update: jest.fn(async ({ data }) => {
        state.proposalStatus = data.status;
        return currentProposal();
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (state.proposalStatus !== where.status) return { count: 0 };
        state.proposalStatus = data.status;
        return { count: 1 };
      }),
    };
    const process = {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ data }) => {
        state.processStatus = data.status;
        state.acceptedProposalId = data.accepted_proposal_id;
        return {};
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (state.processStatus !== where.status) return { count: 0 };
        state.processStatus = data.status;
        state.acceptedProposalId = data.accepted_proposal_id;
        return { count: 1 };
      }),
    };
    const prisma = {
      negotiationProposal,
      process,
      processStatusHistory: {
        create: jest.fn(async () => {
          state.historyCount += 1;
          return {};
        }),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
          negotiationProposal,
          process,
          processStatusHistory: {
            create: jest.fn(async () => {
              state.historyCount += 1;
              return {};
            }),
          },
        }),
      ),
    } as any;
    const notifications = {
      sendProposalAcceptedEmail: jest.fn().mockResolvedValue(undefined),
      sendProposalRejectedEmail: jest.fn().mockResolvedValue(undefined),
      sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ProposalsService(prisma, {} as any, notifications);

    const outcomes = await Promise.allSettled([
      service.accept('proposal-1', 'specialist-1'),
      service.reject('proposal-1', 'specialist-1'),
    ]);

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    if (state.acceptedProposalId !== null) {
      expect(state.proposalStatus).toBe(ProposalStatus.ACCEPTED);
      expect(state.processStatus).toBe(ProcessStatus.DOCUMENTATION);
      expect(state.historyCount).toBe(1);
    } else {
      expect(state.proposalStatus).toBe(ProposalStatus.REJECTED);
      expect(state.processStatus).toBe(ProcessStatus.NEGOTIATION);
      expect(state.historyCount).toBe(0);
    }
  });
});
