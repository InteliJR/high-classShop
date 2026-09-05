import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { validate } from 'class-validator';
import { CreateProcessDTO } from './dto/create-process.dto';
import { AssignProductToProcessDto } from './dto/assign-product.dto';
import { ProcessesService } from './processes.service';

const productId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const specialistId = '33333333-3333-4333-8333-333333333333';

describe('ProcessesService — produto UUID', () => {
  it('persiste e consulta o produto pelo UUID sem conversão numérica', async () => {
    const rootFindFirst = jest.fn().mockResolvedValue(null);
    const transactionalFindFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: '44444444-4444-4444-8444-444444444444',
        status: 'SCHEDULING',
        product_type: data.product_type,
        ...data,
        client: { id: clientId, email: 'client@example.com', name: 'Client' },
        specialist: {
          id: specialistId,
          name: 'Specialist',
          speciality: 'CAR',
        },
        car: { id: productId, marca: 'Porsche', modelo: '911' },
        aircraft: null,
        boat: null,
        created_at: new Date(),
        notes: null,
      }),
    );
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: specialistId,
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
        }),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: productId,
          specialist_id: specialistId,
          is_active: true,
        }),
      },
      boat: { findUnique: jest.fn() },
      aircraft: { findUnique: jest.fn() },
      process: { findFirst: rootFindFirst },
      $transaction: jest.fn(async (callback) =>
        callback({
          $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: specialistId,
              role: UserRole.SPECIALIST,
              speciality: ProductType.CAR,
            }),
          },
          car: {
            findUnique: jest.fn().mockResolvedValue({
              id: productId,
              specialist_id: specialistId,
              is_active: true,
            }),
          },
          boat: { findUnique: jest.fn() },
          aircraft: { findUnique: jest.fn() },
          process: { findFirst: transactionalFindFirst, create },
          processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await service.create(
      {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: 'CAR',
        product_id: productId,
      } as unknown as CreateProcessDTO,
      // ADMIN: passa direto pela autorização, o foco deste teste é o UUID
      { id: 'admin1', role: 'ADMIN' as any },
    );

    expect(rootFindFirst).not.toHaveBeenCalled();
    expect(transactionalFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ car_id: productId }),
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ car_id: productId }),
      }),
    );
  });

  it('aceita UUID v4 e rejeita identificador numérico nos DTOs de processo', async () => {
    const createDto = Object.assign(new CreateProcessDTO(), {
      client_id: clientId,
      specialist_id: specialistId,
      product_type: 'CAR',
      product_id: productId,
    });
    const assignDto = Object.assign(new AssignProductToProcessDto(), {
      product_type: 'CAR',
      product_id: productId,
    });

    expect(await validate(createDto)).toHaveLength(0);
    expect(await validate(assignDto)).toHaveLength(0);

    createDto.product_id = 1 as never;
    assignDto.product_id = 1 as never;

    expect(
      (await validate(createDto)).some(
        (error) => error.property === 'product_id',
      ),
    ).toBe(true);
    expect(
      (await validate(assignDto)).some(
        (error) => error.property === 'product_id',
      ),
    ).toBe(true);
  });

  it.each([{ product_type: ProductType.CAR }, { product_id: productId }])(
    'rejeita seleção parcial de produto: %o',
    async (partial) => {
      const dto = Object.assign(new CreateProcessDTO(), {
        client_id: clientId,
        specialist_id: specialistId,
        ...partial,
      });

      const errors = await validate(dto);

      expect(
        errors.some((error) =>
          ['product_type', 'product_id'].includes(error.property),
        ),
      ).toBe(true);
    },
  );
});

describe('ProcessesService.create — autorização por cliente', () => {
  const companyId = '66666666-6666-4666-8666-666666666666';

  function mkService(clientLookup: any = null) {
    const findFirst = jest.fn().mockResolvedValue(clientLookup);
    const prisma = {
      user: { findFirst },
      process: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    } as any;
    return { service: new ProcessesService(prisma, {} as any), findFirst };
  }

  const dto = {
    client_id: clientId,
    specialist_id: specialistId,
    product_type: 'CAR',
    product_id: productId,
  } as unknown as CreateProcessDTO;

  it('SPECIALIST não cria processo com outro especialista no lugar dele', async () => {
    const { service } = mkService();

    await expect(
      service.create(dto, { id: 'outro-esp', role: 'SPECIALIST' as any }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('CUSTOMER não cria processo em nome de outro cliente', async () => {
    const { service } = mkService();

    await expect(
      service.create(dto, { id: 'outro-cliente', role: 'CUSTOMER' as any }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('CONSULTANT não cria processo para cliente que não é dele', async () => {
    const { service } = mkService(null); // lookup não encontra vínculo

    await expect(
      service.create(dto, { id: 'cons1', role: 'CONSULTANT' as any }),
    ).rejects.toThrow(ForbiddenException);
  });

  // Critério de aceite da task: cliente de outra empresa é bloqueado.
  it('OFFICE não cria processo para cliente de outra empresa', async () => {
    const { service, findFirst } = mkService(null);

    await expect(
      service.create(dto, {
        id: 'office1',
        role: 'OFFICE' as any,
        companyId,
      }),
    ).rejects.toThrow(ForbiddenException);

    // Confirma que a checagem usou a regra de cliente do escritório
    expect(findFirst.mock.calls[0][0].where.OR).toEqual([
      { consultant: { company_id: companyId } },
      { company_id: companyId },
    ]);
  });

  it('OFFICE sem company_id é barrado', async () => {
    const { service } = mkService();

    await expect(
      service.create(dto, {
        id: 'office1',
        role: 'OFFICE' as any,
        companyId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('papel desconhecido é barrado (fail closed)', async () => {
    const { service } = mkService();

    await expect(
      service.create(dto, { id: 'x', role: 'ALGO_NOVO' as any }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('ProcessesService.createOnBehalfOfClient', () => {
  function mkService(
    specialist: any = {
      id: specialistId,
      role: UserRole.SPECIALIST,
      speciality: ProductType.CAR,
    },
    product: any = {
      id: productId,
      specialist_id: specialistId,
      is_active: true,
    },
  ) {
    const appointmentCreate = jest
      .fn()
      .mockResolvedValue({ id: 'appointment-1' });
    const processCreate = jest.fn().mockResolvedValue({ id: 'process-1' });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      user: { findUnique: jest.fn().mockResolvedValue(specialist) },
      car: { findUnique: jest.fn().mockResolvedValue(product) },
      boat: { findUnique: jest.fn().mockResolvedValue(product) },
      aircraft: { findUnique: jest.fn().mockResolvedValue(product) },
      appointment: { create: appointmentCreate },
      process: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: processCreate,
      },
      processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(specialist) },
      process: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb) => cb(tx)),
    } as any;
    return {
      service: new ProcessesService(prisma, {} as any),
      appointmentCreate,
      processCreate,
      tx,
    };
  }

  const base = {
    client_id: clientId,
    specialist_id: specialistId,
    product_type: 'CAR' as const,
    product_id: productId,
    createdBy: 'ator1',
  };

  // O Appointment é a razão de existir deste método: sem ele o especialista
  // não consegue confirmar o agendamento e o processo fica sem saída natural.
  it('cria o Appointment pendente junto com o processo', async () => {
    const { service, appointmentCreate, processCreate } = mkService();

    await service.createOnBehalfOfClient({
      ...base,
      actorLabel: 'gerente do escritório',
    });

    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
    expect(processCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SCHEDULING',
          appointment_id: 'appointment-1',
        }),
      }),
    );
  });

  it('serializa e repete a deduplicação dentro da transação', async () => {
    const { service, tx } = mkService();

    await service.createOnBehalfOfClient({
      ...base,
      actorLabel: 'gerente do escritório',
    });

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      `process-dedup:${clientId}:${specialistId}:CAR:${productId}`,
    );
    expect(tx.process.findFirst).toHaveBeenCalledTimes(1);
  });

  it('registra nas notas quem abriu o processo', async () => {
    const { service, processCreate } = mkService();

    await service.createOnBehalfOfClient({
      ...base,
      actorLabel: 'gerente do escritório',
    });

    expect(processCreate.mock.calls[0][0].data.notes).toContain(
      'gerente do escritório',
    );
  });

  it('sem produto cria consultoria (product_type null)', async () => {
    const { service, processCreate } = mkService();

    await service.createOnBehalfOfClient({
      ...base,
      product_id: undefined,
      actorLabel: 'consultor',
    });

    const data = processCreate.mock.calls[0][0].data;
    expect(data.product_type).toBeNull();
    expect(data.notes).toContain('Consultoria');
  });

  it('especialista inexistente é rejeitado', async () => {
    const { service } = mkService(null);

    await expect(
      service.createOnBehalfOfClient({ ...base, actorLabel: 'consultor' }),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    [
      'inativo',
      { id: productId, specialist_id: specialistId, is_active: false },
      BadRequestException,
    ],
    [
      'de outro especialista',
      { id: productId, specialist_id: 'other-specialist', is_active: true },
      ForbiddenException,
    ],
  ])(
    'rejeita produto %s dentro da transação antes de criar registros',
    async (_label, product, expectedError) => {
      const { service, appointmentCreate, processCreate, tx } = mkService(
        undefined,
        product,
      );

      await expect(
        service.createOnBehalfOfClient({
          ...base,
          actorLabel: 'gerente do escritório',
        }),
      ).rejects.toThrow(expectedError);
      expect(tx.user.findUnique).toHaveBeenCalled();
      expect(tx.car.findUnique).toHaveBeenCalled();
      expect(appointmentCreate).not.toHaveBeenCalled();
      expect(processCreate).not.toHaveBeenCalled();
    },
  );
});

describe('ProcessesService.getAll — escopo de visibilidade', () => {
  const companyId = '55555555-5555-4555-8555-555555555555';

  /**
   * Monta o service com um Prisma falso e devolve os mocks das três queries que
   * o getAll dispara, para inspecionar o `where` que cada uma recebeu.
   */
  function mkService() {
    const findMany = jest.fn().mockReturnValue([]);
    const count = jest.fn().mockReturnValue(0);
    const groupBy = jest.fn().mockReturnValue([]);
    const prisma = {
      process: { findMany, count, groupBy },
      // getAll passa um array de queries; devolvemos o resultado de cada mock
      // na mesma ordem em que são montadas.
      $transaction: jest.fn(async () => [[], 0, []]),
    } as any;

    return {
      service: new ProcessesService(prisma, {} as any),
      findMany,
      groupBy,
    };
  }

  const baseQuery = { page: 1, perPage: 20 } as any;

  it('ADMIN não recebe filtro de visibilidade', async () => {
    const { service, findMany } = mkService();

    await service.getAll({
      ...baseQuery,
      requester: { id: 'admin1', role: 'ADMIN' as any },
    });

    expect(findMany.mock.calls[0][0].where.AND).toBeUndefined();
  });

  it('OFFICE só enxerga clientes da própria empresa', async () => {
    const { service, findMany } = mkService();

    await service.getAll({
      ...baseQuery,
      requester: { id: 'office1', role: 'OFFICE' as any, companyId },
    });

    expect(findMany.mock.calls[0][0].where.AND).toEqual([
      {
        client: {
          role: 'CUSTOMER',
          OR: [
            { consultant: { company_id: companyId } },
            { company_id: companyId },
          ],
        },
      },
    ]);
  });

  it('OFFICE sem company_id é barrado em vez de ver tudo', async () => {
    const { service } = mkService();

    await expect(
      service.getAll({
        ...baseQuery,
        requester: { id: 'office1', role: 'OFFICE' as any, companyId: null },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['CUSTOMER', 'cliente1', { client_id: 'cliente1' }],
    ['SPECIALIST', 'esp1', { specialist_id: 'esp1' }],
    ['CONSULTANT', 'cons1', { client: { consultant_id: 'cons1' } }],
  ])('%s enxerga apenas os próprios processos', async (role, id, expected) => {
    const { service, findMany } = mkService();

    await service.getAll({
      ...baseQuery,
      requester: { id, role: role as any },
    });

    expect(findMany.mock.calls[0][0].where.AND).toEqual([expected]);
  });

  it('papel desconhecido é barrado (fail closed)', async () => {
    const { service } = mkService();

    await expect(
      service.getAll({
        ...baseQuery,
        requester: { id: 'x', role: 'ALGO_NOVO' as any },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // Regressão: a busca textual escreve em `where.OR`. Se o escopo morasse no
  // mesmo nível, a busca o sobrescreveria e um escritório veria processos de
  // outro ao digitar na busca.
  it('busca textual não desfaz o escopo do escritório', async () => {
    const { service, findMany } = mkService();

    await service.getAll({
      ...baseQuery,
      search: 'porsche',
      requester: { id: 'office1', role: 'OFFICE' as any, companyId },
    });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].client.OR).toBeDefined();
    expect(where.OR).toBeDefined();
  });

  // Regressão: o groupBy do sumário rodava sem `where` nenhum e devolvia a
  // contagem da plataforma inteira para qualquer usuário.
  it('sumário por status respeita o escopo', async () => {
    const { service, groupBy } = mkService();

    await service.getAll({
      ...baseQuery,
      requester: { id: 'office1', role: 'OFFICE' as any, companyId },
    });

    expect(groupBy.mock.calls[0][0].where.AND).toBeDefined();
  });

  // O sumário conta quantos processos há em CADA status, então não pode herdar
  // o filtro de status — senão selecionar uma aba zera o contador das outras.
  it('sumário ignora o filtro de status, a listagem aplica', async () => {
    const { service, findMany, groupBy } = mkService();

    await service.getAll({
      ...baseQuery,
      status: 'NEGOTIATION' as any,
      requester: { id: 'admin1', role: 'ADMIN' as any },
    });

    expect(findMany.mock.calls[0][0].where.status).toBe('NEGOTIATION');
    expect(groupBy.mock.calls[0][0].where.status).toBeUndefined();
  });
});

describe('ProcessesService — snapshot de entrada na negociação', () => {
  const usdProduct = {
    id: 'product-1',
    marca: 'Porsche',
    modelo: '911',
    valor: new Prisma.Decimal('120000.00'),
    currency: ProductCurrency.USD,
    specialist_id: 'specialist-1',
    is_active: true,
  };

  function baseProcess(overrides: Record<string, unknown> = {}) {
    return {
      id: 'process-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: ProcessStatus.SCHEDULING,
      product_type: ProductType.CAR,
      car_id: 'product-1',
      boat_id: null,
      aircraft_id: null,
      appointment_id: 'appointment-1',
      negotiation_currency: null,
      negotiation_product_value: null,
      notes: null,
      client: { id: 'client-1', email: null, name: 'Cliente' },
      specialist: {
        id: 'specialist-1',
        email: null,
        name: 'Especialista',
        surname: null,
        speciality: ProductType.CAR,
      },
      car: usdProduct,
      boat: null,
      aircraft: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('grava snapshot USD na transição manual para negociação', async () => {
    const processUpdate = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...baseProcess(),
        ...data,
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      }),
    );
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseProcess()),
        update: processUpdate,
        updateMany: processUpdateMany,
      },
      processStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await service.update(
      'process-1',
      { status: ProcessStatus.NEGOTIATION, notes: 'Negociando' },
      'admin-1',
      UserRole.ADMIN,
    );

    expect(processUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.SCHEDULING,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        data: expect.objectContaining({
          status: ProcessStatus.NEGOTIATION,
          negotiation_currency: ProductCurrency.USD,
          negotiation_product_value: new Prisma.Decimal('120000.00'),
        }),
      }),
    );
    expect(processUpdate).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('product-money:CAR:product-1');
  });

  it('returns conflict and creates no history when the manual transition loses its CAS claim', async () => {
    const historyCreate = jest.fn();
    const processUpdate = jest.fn().mockResolvedValue({
      ...baseProcess(),
      status: ProcessStatus.NEGOTIATION,
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseProcess()),
        update: processUpdate,
        updateMany: processUpdateMany,
      },
      processStatusHistory: {
        create: historyCreate,
        findMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await expect(
      service.update(
        'process-1',
        { status: ProcessStatus.NEGOTIATION, notes: 'Negociando' },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(processUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.SCHEDULING,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    );
    expect(processUpdate).not.toHaveBeenCalled();
    expect(historyCreate).not.toHaveBeenCalled();
  });

  function makeAssignProductService(
    processOverrides: Record<string, unknown> = {},
  ) {
    const process = baseProcess({
      status: ProcessStatus.NEGOTIATION,
      product_type: null,
      car_id: null,
      boat_id: null,
      aircraft_id: null,
      car: null,
      ...processOverrides,
    });
    const processUpdate = jest.fn().mockImplementation(({ data }) => {
      const selectedProduct =
        data.product_type === ProductType.CAR
          ? { car: usdProduct, boat: null, aircraft: null }
          : data.product_type === ProductType.BOAT
            ? { car: null, boat: usdProduct, aircraft: null }
            : { car: null, boat: null, aircraft: usdProduct };
      return Promise.resolve({ ...process, ...data, ...selectedProduct });
    });
    let claimedData: Record<string, unknown> = {};
    const processUpdateMany = jest.fn().mockImplementation(({ data }) => {
      claimedData = data;
      return Promise.resolve({ count: 1 });
    });
    const processFindUniqueOrThrow = jest.fn().mockImplementation(() => {
      const selectedProduct =
        claimedData.product_type === ProductType.CAR
          ? { car: usdProduct, boat: null, aircraft: null }
          : claimedData.product_type === ProductType.BOAT
            ? { car: null, boat: usdProduct, aircraft: null }
            : { car: null, boat: null, aircraft: usdProduct };
      return Promise.resolve({
        ...process,
        ...claimedData,
        ...selectedProduct,
      });
    });
    const historyCreate = jest.fn().mockResolvedValue({});
    const txProductFindUnique = jest.fn().mockResolvedValue(usdProduct);
    const rootProductFindUnique = jest.fn();
    const txLock = jest.fn().mockResolvedValue([{ locked: null }]);
    const processFindFirst = jest.fn().mockResolvedValue(null);
    const tx = {
      $queryRaw: txLock,
      process: {
        update: processUpdate,
        updateMany: processUpdateMany,
        findUniqueOrThrow: processFindUniqueOrThrow,
        findFirst: processFindFirst,
      },
      processStatusHistory: { create: historyCreate },
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'appointment-1',
          status: StatusAgendamento.COMPLETED,
        }),
      },
      car: { findUnique: txProductFindUnique },
      boat: { findUnique: txProductFindUnique },
      aircraft: { findUnique: txProductFindUnique },
    };
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'appointment-1',
          status: StatusAgendamento.COMPLETED,
        }),
      },
      car: { findUnique: rootProductFindUnique },
      boat: { findUnique: rootProductFindUnique },
      aircraft: { findUnique: rootProductFindUnique },
      processStatusHistory: { create: historyCreate },
      $transaction: jest.fn(async (operation) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(tx),
      ),
    } as any;

    return {
      service: new ProcessesService(prisma, {} as any),
      prisma,
      processUpdate,
      processUpdateMany,
      processFindUniqueOrThrow,
      historyCreate,
      txProductFindUnique,
      rootProductFindUnique,
      txLock,
      processFindFirst,
    };
  }

  it.each([
    [ProductType.CAR, 'car_id'],
    [ProductType.BOAT, 'boat_id'],
    [ProductType.AIRCRAFT, 'aircraft_id'],
  ])(
    'grava snapshot na associação tardia de %s',
    async (productType, foreignKey) => {
      const {
        service,
        processUpdate,
        processUpdateMany,
        historyCreate,
        txProductFindUnique,
        rootProductFindUnique,
        txLock,
      } = makeAssignProductService();

      await service.assignProduct(
        'process-1',
        { product_type: productType, product_id: 'product-1' },
        'specialist-1',
        UserRole.SPECIALIST,
      );

      expect(processUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'process-1',
            status: ProcessStatus.NEGOTIATION,
            product_type: null,
            car_id: null,
            boat_id: null,
            aircraft_id: null,
          }),
          data: expect.objectContaining({
            [foreignKey]: 'product-1',
            status: ProcessStatus.NEGOTIATION,
            negotiation_currency: ProductCurrency.USD,
            negotiation_product_value: new Prisma.Decimal('120000.00'),
          }),
        }),
      );
      expect(txProductFindUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
      expect(txLock).toHaveBeenCalledTimes(2);
      expect(txLock.mock.calls[0][1]).toBe(
        `product-money:${productType}:product-1`,
      );
      expect(txLock).toHaveBeenCalledWith(
        expect.anything(),
        `process-dedup:client-1:specialist-1:${productType}:product-1`,
      );
      expect(rootProductFindUnique).not.toHaveBeenCalled();
      expect(processUpdate).not.toHaveBeenCalled();
      expect(historyCreate).not.toHaveBeenCalled();
    },
  );

  it('preserva snapshot BRL existente na associação tardia', async () => {
    const { service, processUpdateMany } = makeAssignProductService({
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('90000.00'),
    });

    await service.assignProduct(
      'process-1',
      { product_type: ProductType.CAR, product_id: 'product-1' },
      'specialist-1',
      UserRole.SPECIALIST,
    );

    expect(processUpdateMany.mock.calls[0][0].data).not.toEqual(
      expect.objectContaining({
        negotiation_currency: ProductCurrency.USD,
      }),
    );
    expect(processUpdateMany.mock.calls[0][0].data).not.toEqual(
      expect.objectContaining({
        negotiation_product_value: new Prisma.Decimal('120000.00'),
      }),
    );
  });

  it('rejeita associação quando outro fluxo reivindica o processo antes da gravação', async () => {
    const {
      service,
      processUpdate,
      processUpdateMany,
      processFindUniqueOrThrow,
      historyCreate,
    } = makeAssignProductService({ status: ProcessStatus.SCHEDULING });
    processUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.assignProduct(
        'process-1',
        { product_type: ProductType.CAR, product_id: 'product-1' },
        'specialist-1',
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(ConflictException);

    expect(processUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.SCHEDULING,
          product_type: null,
          car_id: null,
          boat_id: null,
          aircraft_id: null,
          negotiation_currency: null,
          negotiation_product_value: null,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    );
    expect(processUpdate).not.toHaveBeenCalled();
    expect(processFindUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it('cria histórico somente depois de reivindicar SCHEDULING', async () => {
    const { service, processUpdateMany, historyCreate } =
      makeAssignProductService({ status: ProcessStatus.SCHEDULING });

    await service.assignProduct(
      'process-1',
      { product_type: ProductType.CAR, product_id: 'product-1' },
      'specialist-1',
      UserRole.SPECIALIST,
    );

    expect(processUpdateMany).toHaveBeenCalledTimes(1);
    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(processUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      historyCreate.mock.invocationCallOrder[0],
    );
  });

  it('rejeita associação sequencial quando a identidade alvo já tem processo ativo', async () => {
    const {
      service,
      processFindFirst,
      processUpdate,
      processUpdateMany,
      historyCreate,
    } = makeAssignProductService();
    processFindFirst.mockResolvedValue({ id: 'duplicate-process' });

    await expect(
      service.assignProduct(
        'process-1',
        { product_type: ProductType.CAR, product_id: 'product-1' },
        'specialist-1',
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(ConflictException);

    expect(processUpdate).not.toHaveBeenCalled();
    expect(processUpdateMany).not.toHaveBeenCalled();
    expect(historyCreate).not.toHaveBeenCalled();
  });
});
