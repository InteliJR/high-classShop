import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  ProposalStatus,
  UserRole,
} from '@prisma/client';
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
  const transactionProposalCreate = jest
    .fn()
    .mockImplementation(({ data }) =>
      Promise.resolve(proposalFixture({ ...data })),
    );
  const transactionProposalUpdate = jest
    .fn()
    .mockResolvedValue(proposalFixture({ status: ProposalStatus.ACCEPTED }));
  const prisma = {
    process: {
      findUnique: jest.fn(),
    },
    negotiationProposal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback) =>
      callback({
        negotiationProposal: {
          create: transactionProposalCreate,
          update: transactionProposalUpdate,
        },
        process: { update: jest.fn().mockResolvedValue({}) },
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
          negotiation_currency: true,
          negotiation_product_value: true,
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
      const { service, prisma, notifications } = setup();
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
    },
  );
});
