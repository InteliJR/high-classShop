import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
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
    expect(transactionalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ car_id: productId }),
        select: {
          id: true,
          client_id: true,
          appointment: {
            select: {
              id: true,
              client_id: true,
              status: true,
              scheduling_method: true,
              appointment_datetime: true,
            },
          },
          specialist: { select: { email: true } },
        },
      }),
    );
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

  it('SPECIALIST não usa a rota genérica para escolher cliente nem obter PII', async () => {
    const { service } = mkService();

    await expect(
      service.create(dto, { id: specialistId, role: UserRole.SPECIALIST }),
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
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: appointmentCreate,
      },
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

  it('rejeita consultoria em nome do cliente quando há processo ativo mesmo com appointment concluído', async () => {
    const { service, appointmentCreate, tx } = mkService();
    tx.process.findFirst.mockResolvedValue({
      id: 'active-process-1',
      client_id: clientId,
      appointment: {
        id: 'completed-appointment-1',
        client_id: clientId,
        status: StatusAgendamento.COMPLETED,
        scheduling_method: AppointmentSchedulingMethod.EMAIL,
        appointment_datetime: new Date('2026-01-01T10:00:00.000Z'),
      },
    });

    await expect(
      service.createOnBehalfOfClient({
        ...base,
        product_id: undefined,
        actorLabel: 'consultor',
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client_id: clientId,
          specialist_id: specialistId,
          product_type: null,
          status: { in: expect.arrayContaining([ProcessStatus.SCHEDULING]) },
        }),
      }),
    );
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('rejeita consultoria em nome do cliente diante de processo ativo legado sem appointment', async () => {
    const { service, appointmentCreate, tx } = mkService();
    tx.process.findFirst.mockResolvedValue({
      id: 'legacy-active-process-1',
      client_id: clientId,
      appointment: null,
    });

    await expect(
      service.createOnBehalfOfClient({
        ...base,
        product_id: undefined,
        actorLabel: 'consultor',
      }),
    ).rejects.toThrow(ConflictException);

    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('rejeita consultoria duplicada em nome do cliente', async () => {
    const { service, appointmentCreate, tx } = mkService();
    tx.appointment.findFirst.mockResolvedValue({
      id: 'existing-appointment-1',
      status: StatusAgendamento.PENDING,
    });

    await expect(
      service.createOnBehalfOfClient({
        ...base,
        product_id: undefined,
        actorLabel: 'consultor',
      }),
    ).rejects.toThrow(ConflictException);

    expect(appointmentCreate).not.toHaveBeenCalled();
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

  it('maps appointment origin and definitive reschedule audit', async () => {
    const rescheduledAt = new Date('2099-01-02T10:00:00.000Z');
    const rescheduledFrom = new Date('2099-01-01T10:00:00.000Z');
    const process = {
      id: 'process-1',
      appointment_id: 'appointment-1',
      client_id: clientId,
      specialist_id: specialistId,
      status: ProcessStatus.SCHEDULING,
      product_type: ProductType.CAR,
      car_id: productId,
      boat_id: null,
      aircraft_id: null,
      client: { id: clientId, name: 'Client', email: 'client@example.com' },
      specialist: {
        id: specialistId,
        name: 'Specialist',
        speciality: ProductType.CAR,
      },
      car: { id: productId, marca: 'Porsche', modelo: '911' },
      boat: null,
      aircraft: null,
      appointment: {
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: new Date('2099-01-02T10:00:00.000Z'),
        scheduling_method: 'EMAIL',
        specialist_rescheduled_at: rescheduledAt,
        specialist_rescheduled_from: rescheduledFrom,
      },
      created_at: new Date(),
      notes: null,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const findMany = jest.fn().mockReturnValue([process]);
    const prisma = {
      process: {
        findMany,
        count: jest.fn().mockReturnValue(1),
        groupBy: jest.fn().mockReturnValue([]),
      },
      $transaction: jest.fn(async (queries: any[]) => queries),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    const result = await service.getAll({
      page: 1,
      perPage: 20,
      requester: { id: 'admin-1', role: UserRole.ADMIN },
    });

    expect(findMany.mock.calls[0][0].include.appointment.select).toEqual(
      expect.objectContaining({
        scheduling_method: true,
        specialist_rescheduled_at: true,
        specialist_rescheduled_from: true,
      }),
    );
    expect(result.processes[0]).toEqual(
      expect.objectContaining({
        appointment_id: 'appointment-1',
        appointment_scheduling_method: 'EMAIL',
        specialist_rescheduled_at: rescheduledAt,
        specialist_rescheduled_from: rescheduledFrom,
      }),
    );
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

  it('bloqueia a transição manual para negociação, reservada ao fluxo canônico', async () => {
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

    await expect(
      service.update(
        'process-1',
        { status: ProcessStatus.NEGOTIATION, notes: 'Negociando' },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
    expect(processUpdate).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(
      'appointment-schedule:specialist-1',
    );
  });

  it('returns conflict and creates no history when the manual transition loses its CAS claim', async () => {
    const historyCreate = jest.fn();
    const processUpdate = jest.fn().mockResolvedValue({
      ...baseProcess(),
      status: ProcessStatus.NEGOTIATION,
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const negotiatedProcess = baseProcess({
      status: ProcessStatus.NEGOTIATION,
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(negotiatedProcess),
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
        { status: ProcessStatus.DOCUMENTATION, notes: 'Documentação' },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(processUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.NEGOTIATION,
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

describe('ProcessesService.confirmAppointment — horário acordado', () => {
  const futureIso = '2099-01-01T13:00:00.000Z';

  function makeService(
    appointmentOverrides: Record<string, unknown> = {},
    processClaimCount = 1,
  ) {
    const appointment = {
      id: 'appointment-1',
      specialist_id: specialistId,
      client_id: clientId,
      status: StatusAgendamento.PENDING,
      appointment_datetime: null,
      scheduling_method: 'EMAIL',
      confirmed_at: null,
      confirmed_by_id: null,
      specialist_rescheduled_at: null,
      specialist_rescheduled_from: null,
      ...appointmentOverrides,
    };
    const process = {
      id: 'process-1',
      specialist_id: specialistId,
      client_id: clientId,
      status: ProcessStatus.SCHEDULING,
      appointment_id: appointment.id,
      notes: null,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      appointment,
      client: {
        id: clientId,
        email: 'client@example.com',
        name: 'Client',
        surname: 'Example',
      },
      specialist: {
        id: specialistId,
        email: 'specialist@example.com',
        name: 'Specialist',
        surname: 'Example',
      },
      car: null,
      boat: null,
      aircraft: null,
    };
    let stored = structuredClone(process);
    let working = stored;
    const appointmentUpdate = jest.fn().mockImplementation(({ data }) => {
      Object.assign(working.appointment, data);
      return Promise.resolve(structuredClone(working.appointment));
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findFirst: jest.fn().mockResolvedValue(null),
        update: appointmentUpdate,
      },
      process: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve(structuredClone(working))),
        updateMany: jest.fn().mockImplementation(({ data }) => {
          if (processClaimCount === 1) Object.assign(working, data);
          return Promise.resolve({ count: processClaimCount });
        }),
      },
      processStatusHistory: { create: jest.fn() },
    };
    const prisma = {
      process: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve(structuredClone(stored))),
      },
      $transaction: jest.fn(async (callback: any) => {
        working = structuredClone(stored);
        const result = await callback(tx);
        stored = working;
        return result;
      }),
    } as any;
    const notifications = {
      sendAppointmentConfirmedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    return {
      service: new ProcessesService(prisma, notifications),
      tx,
      appointmentUpdate,
      prisma,
      notifications,
      stored: () => structuredClone(stored),
      mutate: (change: (value: typeof process) => void) => change(stored),
    };
  }

  it('requires a datetime when an EMAIL request has none', async () => {
    const { service, appointmentUpdate } = makeService();

    await expect(
      (service.confirmAppointment as any)('process-1', specialistId, undefined),
    ).rejects.toThrow(BadRequestException);
    expect(appointmentUpdate).not.toHaveBeenCalled();
  });

  it('confirms the stored EMAIL proposal without requiring a second datetime', async () => {
    const { service, stored } = makeService({
      appointment_datetime: new Date(futureIso),
    });

    await expect(
      service.confirmAppointment('process-1', specialistId),
    ).resolves.toMatchObject({
      status: ProcessStatus.SCHEDULING,
      appointment_status: StatusAgendamento.SCHEDULED,
      appointment_datetime: new Date(futureIso),
    });
    expect(stored().status).toBe(ProcessStatus.SCHEDULING);
    expect(stored().appointment).toMatchObject({
      confirmed_by_id: specialistId,
      confirmed_at: expect.anything(),
      specialist_rescheduled_at: null,
      specialist_rescheduled_from: null,
    });
  });

  it('stores the initial datetime without consuming the definitive change', async () => {
    const { service, tx, appointmentUpdate } = makeService();

    await (service.confirmAppointment as any)(
      'process-1',
      specialistId,
      futureIso,
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      `appointment-schedule:${specialistId}`,
    );
    expect(appointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointment_datetime: new Date(futureIso),
          status: StatusAgendamento.SCHEDULED,
        }),
      }),
    );
    expect(tx.process.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.SCHEDULING,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
          specialist_id: specialistId,
          client_id: clientId,
          appointment_id: 'appointment-1',
          notes: null,
        },
      }),
    );
    const updateData = appointmentUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('specialist_rescheduled_at');
    expect(updateData).not.toHaveProperty('specialist_rescheduled_from');
    expect(tx.process.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      appointmentUpdate.mock.invocationCallOrder[0],
    );
  });

  it('rejects a past datetime before writing', async () => {
    const { service, appointmentUpdate } = makeService();

    await expect(
      (service.confirmAppointment as any)(
        'process-1',
        specialistId,
        '2020-01-01T13:00:00.000Z',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(appointmentUpdate).not.toHaveBeenCalled();
  });

  it('aborts when the process changes during confirmation', async () => {
    const { service, stored } = makeService({}, 0);
    const before = stored();

    await expect(
      (service.confirmAppointment as any)('process-1', specialistId, futureIso),
    ).rejects.toThrow(ConflictException);
    expect(stored()).toEqual(before);
  });

  it('appends the original proposal and changed confirmed instant without reschedule audit', async () => {
    const proposed = new Date('2099-01-01T10:00:00.000Z');
    const { service, stored, mutate, tx } = makeService({
      appointment_datetime: proposed,
    });
    mutate((process) => {
      process.notes = 'Nota anterior' as any;
    });
    await service.confirmAppointment('process-1', specialistId, futureIso);
    expect(stored().notes).toContain('Nota anterior');
    expect(stored().notes).toContain(proposed.toISOString());
    expect(stored().notes).toContain(futureIso);
    expect(stored().appointment).toMatchObject({
      appointment_datetime: new Date(futureIso),
      specialist_rescheduled_at: null,
      specialist_rescheduled_from: null,
    });
    expect(tx.processStatusHistory.create).not.toHaveBeenCalled();
  });

  it('returns the same confirmation on double submission without new notes or emails', async () => {
    const { service, stored, appointmentUpdate, notifications, tx } =
      makeService();
    const first = await service.confirmAppointment(
      'process-1',
      specialistId,
      futureIso,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const afterFirst = stored();
    const second = await service.confirmAppointment(
      'process-1',
      specialistId,
      futureIso,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(second).toEqual(first);
    expect(stored()).toEqual(afterFirst);
    expect(appointmentUpdate).toHaveBeenCalledTimes(1);
    expect(tx.process.updateMany).toHaveBeenCalledTimes(1);
    expect(notifications.sendAppointmentConfirmedEmail).toHaveBeenCalledTimes(
      1,
    );
  });

  it('accepts the identical retry after the confirmed instant has passed', async () => {
    const { service, stored, appointmentUpdate } = makeService();
    const first = await service.confirmAppointment(
      'process-1',
      specialistId,
      futureIso,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const before = stored();
    jest.useFakeTimers({ now: new Date('2100-01-01T00:00:00Z') });
    try {
      await expect(
        service.confirmAppointment('process-1', specialistId, futureIso),
      ).resolves.toEqual(first);
      expect(stored()).toEqual(before);
      expect(appointmentUpdate).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses a single confirmation timestamp in the appointment and appended note', async () => {
    const { service, stored } = makeService();
    await service.confirmAppointment('process-1', specialistId, futureIso);
    expect(stored().notes).toContain(
      (stored().appointment.confirmed_at as unknown as Date).toISOString(),
    );
  });

  it('notifies the participant snapshot reread under the schedule lock', async () => {
    const { service, tx, stored, mutate, notifications } = makeService();
    tx.$queryRaw.mockImplementation(async () => {
      mutate((process) => {
        process.client.email = 'current-client@example.com';
      });
      tx.process.findUnique.mockImplementation(async () => stored());
      return [{ locked: null }];
    });
    await service.confirmAppointment('process-1', specialistId, futureIso);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(notifications.sendAppointmentConfirmedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: 'current-client@example.com' }),
    );
  });

  it('rolls back a claimed process when updating the appointment fails', async () => {
    const { service, tx, stored, notifications } = makeService();
    const before = stored();
    tx.appointment.update.mockRejectedValue(new Error('storage failure'));
    await expect(
      service.confirmAppointment('process-1', specialistId, futureIso),
    ).rejects.toThrow('storage failure');
    expect(stored()).toEqual(before);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(notifications.sendAppointmentConfirmedEmail).not.toHaveBeenCalled();
  });

  it('never treats a different datetime as an idempotent confirmation', async () => {
    const { service, stored } = makeService();
    await service.confirmAppointment('process-1', specialistId, futureIso);
    const before = stored();
    await expect(
      service.confirmAppointment(
        'process-1',
        specialistId,
        '2099-01-02T13:00:00Z',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(stored()).toEqual(before);
  });

  it.each([undefined, '2099-01-01T10:00:00-03:00'])(
    'accepts an identical retry with omitted/equivalent-offset datetime %s',
    async (datetime) => {
      const { service, stored, appointmentUpdate } = makeService();
      const first = await service.confirmAppointment(
        'process-1',
        specialistId,
        futureIso,
      );
      const before = stored();
      await expect(
        service.confirmAppointment('process-1', specialistId, datetime),
      ).resolves.toEqual(first);
      expect(stored()).toEqual(before);
      expect(appointmentUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [StatusAgendamento.COMPLETED, specialistId, new Date()],
    [StatusAgendamento.CANCELLED, specialistId, new Date()],
    [StatusAgendamento.SCHEDULED, null, null],
    [StatusAgendamento.SCHEDULED, 'another-specialist', new Date()],
  ])(
    'does not treat status %s with confirmation actor %s as an initial confirmation retry',
    async (status, actor, at) => {
      const { service, stored } = makeService({
        status,
        confirmed_by_id: actor,
        confirmed_at: at,
        appointment_datetime: new Date(futureIso),
      });
      const before = stored();
      await expect(
        service.confirmAppointment('process-1', specialistId, futureIso),
      ).rejects.toThrow(BadRequestException);
      expect(stored()).toEqual(before);
    },
  );

  it.each(['owner', 'status', 'appointment-client', 'appointment-owner'])(
    'rejects %s changed before the transactional reread',
    async (change) => {
      const { service, tx, stored, mutate } = makeService();
      tx.$queryRaw.mockImplementation(async () => {
        mutate((process) => {
          if (change === 'owner') process.specialist_id = 'other-specialist';
          if (change === 'status')
            process.status = ProcessStatus.REJECTED as any;
          if (change === 'appointment-client')
            process.appointment.client_id = 'other-client';
          if (change === 'appointment-owner')
            process.appointment.specialist_id = 'other-specialist';
        });
        tx.process.findUnique.mockImplementation(async () => stored());
        return [{ locked: null }];
      });
      await expect(
        service.confirmAppointment('process-1', specialistId, futureIso),
      ).rejects.toThrow(
        change === 'owner' ? ForbiddenException : BadRequestException,
      );
      expect(tx.process.updateMany).not.toHaveBeenCalled();
      expect(tx.appointment.update).not.toHaveBeenCalled();
    },
  );

  it('rejects an instant equal to now after rereading without writes', async () => {
    const { service, tx } = makeService();
    jest.useFakeTimers({ now: new Date(futureIso) });
    try {
      await expect(
        service.confirmAppointment('process-1', specialistId, futureIso),
      ).rejects.toThrow(BadRequestException);
      expect(tx.process.updateMany).not.toHaveBeenCalled();
      expect(tx.appointment.update).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    'not-a-date',
    '2020-01-01T13:00:00Z',
    '2099-02-30T13:00:00Z',
    '2099-01-01',
    '2099-01-01T13:00:00',
  ])(
    'rejects invalid or ambiguous instant %s before writes',
    async (datetime) => {
      const { service, stored, appointmentUpdate } = makeService();
      const before = stored();
      await expect(
        service.confirmAppointment('process-1', specialistId, datetime),
      ).rejects.toThrow(BadRequestException);
      expect(stored()).toEqual(before);
      expect(appointmentUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([clientId, 'other-specialist', 'admin-user'])(
    'rejects confirmation by unassigned actor %s before locking',
    async (actorId) => {
      const { service, tx } = makeService();
      await expect(
        service.confirmAppointment('process-1', actorId, futureIso),
      ).rejects.toThrow(ForbiddenException);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it('rejects an appointment whose client is inconsistent with its process', async () => {
    const { service, stored } = makeService({ client_id: 'other-client' });
    const before = stored();
    await expect(
      service.confirmAppointment('process-1', specialistId, futureIso),
    ).rejects.toThrow(BadRequestException);
    expect(stored()).toEqual(before);
  });

  it('uses the appointment reread after the lock for the stored proposal', async () => {
    const { service, tx, stored, mutate } = makeService({
      appointment_datetime: new Date(futureIso),
    });
    tx.$queryRaw.mockImplementation(async () => {
      mutate((process) => {
        process.appointment.appointment_datetime = new Date(
          '2020-01-01T10:00:00Z',
        ) as any;
      });
      tx.process.findUnique.mockImplementation(async () => stored());
      return [{ locked: null }];
    });
    await expect(
      service.confirmAppointment('process-1', specialistId),
    ).rejects.toThrow(BadRequestException);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('rolls back all state and returns no competing identities on a schedule conflict', async () => {
    const { service, stored, tx, notifications } = makeService({
      appointment_datetime: new Date(futureIso),
    });
    tx.appointment.findFirst.mockResolvedValue({
      id: 'competing-appointment',
      client_id: 'competing-client',
      process: { id: 'competing-process' },
    });
    const before = stored();
    const error = await service
      .confirmAppointment('process-1', specialistId, futureIso)
      .catch((error) => error);
    expect(error).toBeInstanceOf(ConflictException);
    expect(JSON.stringify(error.getResponse())).not.toMatch(/competing-/);
    expect(stored()).toEqual(before);
    expect(tx.appointment.update).not.toHaveBeenCalled();
    expect(tx.process.updateMany).not.toHaveBeenCalled();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(notifications.sendAppointmentConfirmedEmail).not.toHaveBeenCalled();
  });
});

describe('ProcessesService — telefone da contraparte após confirmação', () => {
  const clientPhone = '11987654321';
  const specialistPhone = '11912345678';

  function processWithAppointment(status: StatusAgendamento | null) {
    return {
      id: 'process-1',
      status: ProcessStatus.SCHEDULING,
      product_type: ProductType.CAR,
      client_id: clientId,
      specialist_id: specialistId,
      client: {
        id: clientId,
        name: 'Cliente',
        email: 'cliente@example.com',
        phone: clientPhone,
        consultant_id: 'consultant-1',
      },
      specialist: {
        id: specialistId,
        name: 'Especialista',
        email: 'especialista@example.com',
        phone: specialistPhone,
        speciality: ProductType.CAR,
      },
      appointment: status
        ? { status, appointment_datetime: new Date('2026-09-14T15:00:00Z') }
        : null,
      car: { id: productId, marca: 'Porsche', modelo: '911' },
      boat: null,
      aircraft: null,
      created_at: new Date('2026-09-14T12:00:00Z'),
      notes: null,
    };
  }

  function listService(status: StatusAgendamento | null) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: UserRole.CUSTOMER,
          consultant_id: 'consultant-1',
        }),
      },
      process: {
        findMany: jest.fn().mockResolvedValue([processWithAppointment(status)]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ id: 'related-process' }),
      },
    } as any;
    return new ProcessesService(prisma, {} as any);
  }

  function detailService(status: StatusAgendamento) {
    const prisma = {
      process: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(processWithAppointment(status)),
      },
    } as any;
    return new ProcessesService(prisma, {} as any);
  }

  it.each([
    [StatusAgendamento.PENDING, null],
    [StatusAgendamento.SCHEDULED, specialistPhone],
    [StatusAgendamento.COMPLETED, specialistPhone],
    [StatusAgendamento.CANCELLED, null],
    [null, null],
  ])(
    'cliente recebe telefone do especialista em %s: %s',
    async (status, expected) => {
      const result = await listService(status).getByClientId(
        clientId,
        { page: 1, perPage: 20 } as any,
        clientId,
        UserRole.CUSTOMER,
      );

      expect(result.processes[0].specialist.phone).toBe(expected);
    },
  );

  it('aplica o mesmo escopo do especialista atribuído em findMany e count da lista por cliente', async () => {
    const service = listService(StatusAgendamento.SCHEDULED);

    await service.getByClientId(
      clientId,
      { page: 1, perPage: 20 } as any,
      specialistId,
      UserRole.SPECIALIST,
    );

    const processDelegate = (service as any).prismaService.process;
    const expectedWhere = {
      client_id: clientId,
      specialist_id: specialistId,
    };
    expect(processDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(processDelegate.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('mantém o vínculo do consultor no where de findMany e count', async () => {
    const service = listService(StatusAgendamento.SCHEDULED);

    await service.getByClientId(
      clientId,
      { page: 1, perPage: 20 } as any,
      'consultant-1',
      UserRole.CONSULTANT,
    );

    const processDelegate = (service as any).prismaService.process;
    const expectedWhere = {
      client_id: clientId,
      client: {
        role: UserRole.CUSTOMER,
        consultant_id: 'consultant-1',
      },
    };
    expect(processDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(processDelegate.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it.each([
    [StatusAgendamento.PENDING, null],
    [StatusAgendamento.SCHEDULED, clientPhone],
    [StatusAgendamento.COMPLETED, clientPhone],
    [StatusAgendamento.CANCELLED, null],
    [null, null],
  ])(
    'especialista recebe telefone do cliente em %s: %s',
    async (status, expected) => {
      const service = listService(status);
      const result = await service.getBySpecialistIdWithFilters(
        specialistId,
        { page: 1, perPage: 20 },
        { id: specialistId, role: UserRole.SPECIALIST },
      );

      expect(result.processes[0].client.phone).toBe(expected);
    },
  );

  it('detalhe oculta o telefone do cliente para especialista em PENDING', async () => {
    const result = await detailService(StatusAgendamento.PENDING).getById(
      'process-1',
      specialistId,
      UserRole.SPECIALIST,
    );

    expect(result.client.phone).toBeNull();
  });

  it('detalhe libera o telefone do especialista para cliente em COMPLETED', async () => {
    const result = await detailService(StatusAgendamento.COMPLETED).getById(
      'process-1',
      clientId,
      UserRole.CUSTOMER,
    );

    expect(result.specialist.phone).toBe(specialistPhone);
  });

  it.each([
    [UserRole.ADMIN, 'admin-1'],
    [UserRole.CONSULTANT, 'consultant-1'],
  ])(
    'detalhe não expõe telefones para %s mesmo após confirmação',
    async (role, requesterId) => {
      const result = await detailService(StatusAgendamento.SCHEDULED).getById(
        'process-1',
        requesterId,
        role,
      );

      expect(result.client.phone).toBeNull();
      expect(result.specialist.phone).toBeNull();
    },
  );

  it('mantém null quando a contraparte não cadastrou telefone', async () => {
    const process = processWithAppointment(StatusAgendamento.SCHEDULED) as any;
    process.specialist.phone = null;
    const prisma = {
      process: {
        findMany: jest.fn().mockResolvedValue([process]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    const result = await service.getByClientId(
      clientId,
      { page: 1, perPage: 20 } as any,
      clientId,
      UserRole.CUSTOMER,
    );

    expect(result.processes[0].specialist.phone).toBeNull();
  });

  it.each([
    [UserRole.ADMIN, 'admin-1'],
    [UserRole.CONSULTANT, 'consultant-1'],
    [UserRole.SPECIALIST, 'other-specialist-1'],
  ])(
    'não expõe telefone do especialista na lista do cliente para %s',
    async (role, requesterId) => {
      const result = await listService(
        StatusAgendamento.SCHEDULED,
      ).getByClientId(
        clientId,
        { page: 1, perPage: 20 } as any,
        requesterId,
        role,
      );

      expect(result.processes[0].specialist.phone).toBeNull();
    },
  );

  it('não expõe telefone do cliente na lista do especialista para ADMIN', async () => {
    const service = listService(StatusAgendamento.SCHEDULED);
    const result = await service.getBySpecialistIdWithFilters(
      specialistId,
      { page: 1, perPage: 20 },
      { id: 'admin-1', role: UserRole.ADMIN },
    );

    expect(result.processes[0].client.phone).toBeNull();
  });
});

describe('ProcessesService — matriz de contatos do cliente', () => {
  const contact = { email: 'cliente@example.com', phone: '11987654321' };
  const cases = [
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
      true,
    ],
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.CALENDLY,
      ProcessStatus.SCHEDULING,
      false,
    ],
    [StatusAgendamento.PENDING, null, ProcessStatus.SCHEDULING, false],
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.REJECTED,
      false,
    ],
    [
      StatusAgendamento.SCHEDULED,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
      true,
    ],
    [
      StatusAgendamento.COMPLETED,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.NEGOTIATION,
      true,
    ],
    [
      StatusAgendamento.CANCELLED,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
      false,
    ],
  ] as const;

  function makeService(
    status: StatusAgendamento,
    method: AppointmentSchedulingMethod | null,
    processStatus: ProcessStatus,
  ) {
    const process = {
      id: 'process-1',
      status: processStatus,
      client_id: clientId,
      specialist_id: specialistId,
      product_type: null,
      client: {
        id: clientId,
        name: 'Cliente',
        consultant_id: 'consultant-1',
        ...contact,
      },
      specialist: {
        id: specialistId,
        name: 'Especialista',
        phone: '11911112222',
        speciality: ProductType.CAR,
      },
      appointment: {
        status,
        scheduling_method: method,
        appointment_datetime: new Date('2099-01-01T13:00:00Z'),
      },
      car: null,
      boat: null,
      aircraft: null,
      notes: null,
      created_at: new Date(),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: UserRole.CUSTOMER,
          consultant_id: 'consultant-1',
        }),
      },
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(process),
        findMany: jest.fn().mockResolvedValue([process]),
        findFirst: jest.fn().mockResolvedValue({ id: process.id }),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    } as any;
    return new ProcessesService(prisma, {} as any);
  }

  it.each(cases)(
    'assigned specialist list and detail expose contacts for %s/%s/%s: %s',
    async (status, method, processStatus, visible) => {
      const service = makeService(status, method, processStatus);
      const detail = await service.getById(
        'process-1',
        specialistId,
        UserRole.SPECIALIST,
      );
      const list = await service.getBySpecialistIdWithFilters(
        specialistId,
        {},
        { id: specialistId, role: UserRole.SPECIALIST },
      );
      const generic = await service.getAll({
        page: 1,
        perPage: 20,
        requester: { id: specialistId, role: UserRole.SPECIALIST },
      });
      for (const result of [detail, list.processes[0], generic.processes[0]]) {
        if (visible) {
          expect(result.client).toMatchObject(contact);
        } else {
          expect(result.client).not.toHaveProperty('email');
          expect(result.client.phone).toBeNull();
        }
      }
    },
  );

  it.each([
    [UserRole.ADMIN, 'admin-1'],
    [UserRole.CONSULTANT, 'consultant-1'],
    [UserRole.OFFICE, 'office-1'],
    [UserRole.SPECIALIST, 'other-specialist'],
    [UserRole.CUSTOMER, clientId],
  ] as const)(
    'specialist list gives %s no client contacts even after confirmation',
    async (role, id) => {
      for (const status of [
        StatusAgendamento.PENDING,
        StatusAgendamento.SCHEDULED,
        StatusAgendamento.COMPLETED,
      ]) {
        const result = await makeService(
          status,
          AppointmentSchedulingMethod.EMAIL,
          ProcessStatus.SCHEDULING,
        ).getBySpecialistIdWithFilters(specialistId, {}, { role, id });
        expect(result.processes[0].client).not.toHaveProperty('email');
        expect(result.processes[0].client.phone).toBeNull();
      }
    },
  );

  it.each([
    [UserRole.ADMIN, 'admin-1'],
    [UserRole.CONSULTANT, 'consultant-1'],
    [UserRole.CUSTOMER, clientId],
  ] as const)('detail gives %s no client contacts', async (role, id) => {
    const result = await makeService(
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
    ).getById('process-1', id, role);
    expect(result.client).not.toHaveProperty('email');
    expect(result.client.phone).toBeNull();
    expect(result.specialist.phone).toBeNull();
  });

  it('detail denies an unidentified actor', async () => {
    await expect(
      makeService(
        StatusAgendamento.PENDING,
        AppointmentSchedulingMethod.EMAIL,
        ProcessStatus.SCHEDULING,
      ).getById('process-1', undefined, undefined),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    [UserRole.SPECIALIST, 'other-specialist'],
    [UserRole.OFFICE, 'office-1'],
  ] as const)('unassigned %s cannot read the detail', async (role, id) => {
    await expect(
      makeService(
        StatusAgendamento.PENDING,
        AppointmentSchedulingMethod.EMAIL,
        ProcessStatus.SCHEDULING,
      ).getById('process-1', id, role),
    ).rejects.toThrow(ForbiddenException);
  });

  it('an actor with the specialist ID but another role cannot read the detail', async () => {
    await expect(
      makeService(
        StatusAgendamento.PENDING,
        AppointmentSchedulingMethod.EMAIL,
        ProcessStatus.SCHEDULING,
      ).getById('process-1', specialistId, UserRole.CONSULTANT),
    ).rejects.toThrow(ForbiddenException);
  });

  it('client list and unscoped legacy specialist projection contain no client contacts', async () => {
    const service = makeService(
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
    );
    const client = await service.getByClientId(
      clientId,
      { page: 1, perPage: 20 },
      clientId,
      UserRole.CUSTOMER,
    );
    const legacy = await service.getBySpecialistId(specialistId, {
      page: 1,
      perPage: 20,
    });
    for (const result of [client.processes[0], legacy.processes[0]]) {
      expect(result.client).not.toHaveProperty('email');
      expect(result.client.phone ?? null).toBeNull();
    }
  });

  it.each([
    UserRole.ADMIN,
    UserRole.CONSULTANT,
    UserRole.OFFICE,
    UserRole.CUSTOMER,
  ])('generic list gives %s no early client contacts', async (role) => {
    const result = await makeService(
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      ProcessStatus.SCHEDULING,
    ).getAll({
      page: 1,
      perPage: 20,
      requester: { id: 'actor', role, companyId: 'company-1' },
    });
    expect(result.processes[0].client).not.toHaveProperty('email');
    expect(result.processes[0].client.phone).toBeNull();
  });

  it.each([UserRole.ADMIN, UserRole.CONSULTANT, UserRole.SPECIALIST])(
    'client list gives unassigned %s no client contacts',
    async (role) => {
      const service = makeService(
        StatusAgendamento.SCHEDULED,
        AppointmentSchedulingMethod.EMAIL,
        ProcessStatus.SCHEDULING,
      );
      const result = await service.getByClientId(
        clientId,
        { page: 1, perPage: 20 },
        role === UserRole.CONSULTANT ? 'consultant-1' : 'unassigned-actor',
        role,
      );
      expect(result.processes[0].client).not.toHaveProperty('email');
      expect(result.processes[0].client.phone).toBeNull();
    },
  );
});

describe('ProcessesService — autorização centralizada de processos', () => {
  const ownerClientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const assignedSpecialistId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const outsiderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const consultantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const clientCompanyId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const otherCompanyId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  function protectedProcess(overrides: Record<string, unknown> = {}) {
    return {
      id: '99999999-9999-4999-8999-999999999999',
      client_id: ownerClientId,
      specialist_id: assignedSpecialistId,
      status: ProcessStatus.SCHEDULING,
      appointment_id: null,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      notes: null,
      product_type: null,
      active_contract_id: 'contract-1',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      client: {
        id: ownerClientId,
        email: 'cliente@example.com',
        name: 'Cliente',
        surname: 'Teste',
        consultant_id: consultantId,
        company_id: null,
        consultant: { company_id: clientCompanyId },
      },
      specialist: {
        id: assignedSpecialistId,
        email: 'especialista@example.com',
        name: 'Especialista',
        surname: 'Teste',
      },
      car: null,
      boat: null,
      aircraft: null,
      appointment: null,
      meeting_session: null,
      ...overrides,
    };
  }

  function updateService(process = protectedProcess()) {
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(process),
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
    return {
      service: new ProcessesService(prisma, {
        sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
      } as any),
      processUpdateMany,
      tx,
    };
  }

  function rejectionService(process = protectedProcess(), claimCount = 1) {
    const rejectedProcess = {
      ...process,
      status: ProcessStatus.REJECTED,
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const processUpdate = jest.fn();
    const processUpdateMany = jest
      .fn()
      .mockResolvedValue({ count: claimCount });
    const processFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce(process)
      .mockResolvedValueOnce(process)
      .mockResolvedValueOnce(rejectedProcess);
    const historyCreate = jest.fn().mockResolvedValue({});
    const rejectionCreate = jest.fn().mockResolvedValue({});
    const meetingSessionDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: processFindUniqueOrThrow,
        update: processUpdate,
        updateMany: processUpdateMany,
      },
      processStatusHistory: {
        create: historyCreate,
        findMany: jest.fn().mockResolvedValue([]),
      },
      processRejection: { create: rejectionCreate },
      meetingSession: { deleteMany: meetingSessionDeleteMany },
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    return {
      service: new ProcessesService(prisma, {
        sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
      } as any),
      processUpdate,
      processUpdateMany,
      processFindUniqueOrThrow,
      historyCreate,
      rejectionCreate,
      meetingSessionDeleteMany,
      tx,
    };
  }

  it.each([
    ProcessStatus.NEGOTIATION,
    ProcessStatus.DOCUMENTATION,
    ProcessStatus.COMPLETED,
  ])('CUSTOMER não pode avançar seu processo para %s', async (nextStatus) => {
    const { service, processUpdateMany } = updateService();

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: nextStatus, notes: 'tentativa indevida' },
        ownerClientId,
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('OFFICE de outra empresa não pode alterar status', async () => {
    const { service, processUpdateMany } = updateService();

    await expect(
      (service.update as any)(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.NEGOTIATION },
        'office-1',
        UserRole.OFFICE,
        otherCompanyId,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('especialista atribuído não pode pular de SCHEDULING para COMPLETED', async () => {
    const { service, processUpdateMany } = updateService();

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.COMPLETED },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('especialista atribuído não pode burlar a confirmação canônica para entrar em NEGOTIATION', async () => {
    const { service, processUpdateMany } = updateService();

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.NEGOTIATION },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('OFFICE da empresa do cliente não pode burlar a confirmação canônica', async () => {
    const { service, processUpdateMany } = updateService();

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.NEGOTIATION },
        'office-1',
        UserRole.OFFICE,
        clientCompanyId,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('não promove consultoria sem produto/snapshot de NEGOTIATION para DOCUMENTATION', async () => {
    const { service, processUpdateMany } = updateService(
      protectedProcess({ status: ProcessStatus.NEGOTIATION }),
    );

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.DOCUMENTATION },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('permite apenas NEGOTIATION para DOCUMENTATION com produto e snapshot', async () => {
    const process = protectedProcess({
      status: ProcessStatus.NEGOTIATION,
      product_type: ProductType.CAR,
      car_id: productId,
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
      car: { id: productId, marca: 'Porsche', modelo: '911' },
    });
    const { service, processUpdateMany } = updateService(process);

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.DOCUMENTATION },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).resolves.toBeDefined();

    expect(processUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('revalida a transição após adquirir o lock e reler o processo', async () => {
    const negotiableProcess = protectedProcess({
      status: ProcessStatus.NEGOTIATION,
      product_type: ProductType.CAR,
      car_id: productId,
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
      car: { id: productId, marca: 'Porsche', modelo: '911' },
    });
    const rejectedProcess = {
      ...negotiableProcess,
      status: ProcessStatus.REJECTED,
    };
    const { service, processUpdateMany, tx } = updateService();
    tx.process.findUniqueOrThrow
      .mockResolvedValueOnce(negotiableProcess)
      .mockResolvedValueOnce(rejectedProcess);

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.DOCUMENTATION },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('revalida a autorização após adquirir o lock e reler o processo', async () => {
    const initiallyAuthorized = protectedProcess({
      status: ProcessStatus.NEGOTIATION,
    });
    const movedToOtherCompany = protectedProcess({
      status: ProcessStatus.NEGOTIATION,
      client: {
        ...protectedProcess().client,
        company_id: otherCompanyId,
        consultant: { company_id: otherCompanyId },
      },
    });
    const { service, processUpdateMany, tx } = updateService();
    tx.process.findUniqueOrThrow
      .mockResolvedValueOnce(initiallyAuthorized)
      .mockResolvedValueOnce(movedToOtherCompany);

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.DOCUMENTATION },
        'office-1',
        UserRole.OFFICE,
        clientCompanyId,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('não conclui DOCUMENTATION manualmente sem o webhook de contrato', async () => {
    const { service, processUpdateMany } = updateService(
      protectedProcess({ status: ProcessStatus.DOCUMENTATION }),
    );

    await expect(
      service.update(
        '99999999-9999-4999-8999-999999999999',
        { status: ProcessStatus.COMPLETED },
        assignedSpecialistId,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('outsider não pode rejeitar processo alheio', async () => {
    const { service, processUpdate, tx } = rejectionService();

    await expect(
      (service.rejectProcess as any)(
        '99999999-9999-4999-8999-999999999999',
        outsiderId,
        undefined,
        UserRole.CUSTOMER,
        null,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(processUpdate).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    [
      'cliente',
      StatusAgendamento.PENDING,
      ownerClientId,
      UserRole.CUSTOMER,
      'Cancele o agendamento pelo fluxo próprio',
    ],
    [
      'especialista',
      StatusAgendamento.PENDING,
      assignedSpecialistId,
      UserRole.SPECIALIST,
      'Cancele o agendamento pelo fluxo próprio',
    ],
    [
      'cliente',
      StatusAgendamento.SCHEDULED,
      ownerClientId,
      UserRole.CUSTOMER,
      'Cancele o agendamento pelo fluxo próprio',
    ],
    [
      'especialista',
      StatusAgendamento.SCHEDULED,
      assignedSpecialistId,
      UserRole.SPECIALIST,
      'Cancele o agendamento pelo fluxo próprio',
    ],
  ])(
    '%s não rejeita processo com appointment %s',
    async (_label, appointmentStatus, actorId, actorRole, expectedMessage) => {
      const { service, processUpdateMany, historyCreate, rejectionCreate, tx } =
        rejectionService(
          protectedProcess({
            appointment_id: 'abababab-abab-4bab-8bab-abababababab',
            appointment: {
              id: 'abababab-abab-4bab-8bab-abababababab',
              client_id: ownerClientId,
              specialist_id: assignedSpecialistId,
              status: appointmentStatus,
            },
          }),
        );

      await expect(
        service.rejectProcess(
          '99999999-9999-4999-8999-999999999999',
          actorId,
          undefined,
          actorRole,
        ),
      ).rejects.toThrow(expectedMessage);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(processUpdateMany).not.toHaveBeenCalled();
      expect(historyCreate).not.toHaveBeenCalled();
      expect(rejectionCreate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['cliente', ownerClientId, UserRole.CUSTOMER],
    ['especialista', assignedSpecialistId, UserRole.SPECIALIST],
  ])(
    '%s não rejeita processo com reunião ativa',
    async (_label, actorId, actorRole) => {
      const { service, processUpdateMany, historyCreate, rejectionCreate } =
        rejectionService(
          protectedProcess({
            meeting_session: { ended_at: null },
          }),
        );

      await expect(
        service.rejectProcess(
          '99999999-9999-4999-8999-999999999999',
          actorId,
          undefined,
          actorRole,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(processUpdateMany).not.toHaveBeenCalled();
      expect(historyCreate).not.toHaveBeenCalled();
      expect(rejectionCreate).not.toHaveBeenCalled();
    },
  );

  it('remove claim de inicialização vencido sob lock e permite rejeitar', async () => {
    const { service, meetingSessionDeleteMany, processUpdateMany, tx } =
      rejectionService(
        protectedProcess({
          meeting_session: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            calendar_event_id: 'meeting-init:claim-vencido',
            started_at: new Date(Date.now() - 3 * 60 * 1000),
            ended_at: null,
          },
        }),
      );

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        ownerClientId,
        'Não tenho mais interesse',
        UserRole.CUSTOMER,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: ProcessStatus.REJECTED }),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(meetingSessionDeleteMany).toHaveBeenCalledWith({
      where: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        calendar_event_id: 'meeting-init:claim-vencido',
      },
    });
    expect(meetingSessionDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      processUpdateMany.mock.invocationCallOrder[0],
    );
  });

  it('mantém claim de inicialização recente e bloqueia rejeição', async () => {
    const { service, meetingSessionDeleteMany, processUpdateMany } =
      rejectionService(
        protectedProcess({
          meeting_session: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            calendar_event_id: 'meeting-init:claim-recente',
            started_at: new Date(),
            ended_at: null,
          },
        }),
      );

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        ownerClientId,
        undefined,
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(meetingSessionDeleteMany).not.toHaveBeenCalled();
    expect(processUpdateMany).not.toHaveBeenCalled();
  });

  it('cliente pode rejeitar o próprio processo sem appointment', async () => {
    const { service, processUpdate, processUpdateMany, tx } =
      rejectionService();

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        ownerClientId,
        'Não tenho mais interesse',
        UserRole.CUSTOMER,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: ProcessStatus.REJECTED }),
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      `appointment-schedule:${assignedSpecialistId}`,
    );
    expect(processUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: '99999999-9999-4999-8999-999999999999',
        status: ProcessStatus.SCHEDULING,
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
      }),
      data: expect.objectContaining({ status: ProcessStatus.REJECTED }),
    });
    expect(processUpdate).not.toHaveBeenCalled();
  });

  it('especialista pode rejeitar processo com appointment cancelado e reunião encerrada', async () => {
    const appointmentId = 'abababab-abab-4bab-8bab-abababababab';
    const { service, processUpdateMany } = rejectionService(
      protectedProcess({
        appointment_id: appointmentId,
        appointment: {
          id: appointmentId,
          client_id: ownerClientId,
          specialist_id: assignedSpecialistId,
          status: StatusAgendamento.CANCELLED,
        },
        meeting_session: { ended_at: new Date('2026-01-01T12:00:00.000Z') },
      }),
    );

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        assignedSpecialistId,
        undefined,
        UserRole.SPECIALIST,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: ProcessStatus.REJECTED }),
    );

    expect(processUpdateMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cliente', ownerClientId, UserRole.CUSTOMER, null],
    [
      'especialista',
      assignedSpecialistId,
      UserRole.SPECIALIST,
      { ended_at: new Date('2026-01-01T12:00:00.000Z') },
    ],
  ])(
    '%s pode rejeitar processo pós-reunião com appointment concluído',
    async (_label, actorId, actorRole, meetingSession) => {
      const appointmentId = 'abababab-abab-4bab-8bab-abababababab';
      const { service, processUpdateMany } = rejectionService(
        protectedProcess({
          status: ProcessStatus.NEGOTIATION,
          appointment_id: appointmentId,
          appointment: {
            id: appointmentId,
            client_id: ownerClientId,
            specialist_id: assignedSpecialistId,
            status: StatusAgendamento.COMPLETED,
          },
          meeting_session: meetingSession,
        }),
      );

      await expect(
        service.rejectProcess(
          '99999999-9999-4999-8999-999999999999',
          actorId,
          undefined,
          actorRole,
        ),
      ).resolves.toEqual(
        expect.objectContaining({ status: ProcessStatus.REJECTED }),
      );

      expect(processUpdateMany).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [
      'id',
      {
        appointment_id: 'abababab-abab-4bab-8bab-abababababab',
        appointment: {
          id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
          client_id: ownerClientId,
          specialist_id: assignedSpecialistId,
          status: StatusAgendamento.CANCELLED,
        },
      },
    ],
    [
      'cliente',
      {
        appointment_id: 'abababab-abab-4bab-8bab-abababababab',
        appointment: {
          id: 'abababab-abab-4bab-8bab-abababababab',
          client_id: outsiderId,
          specialist_id: assignedSpecialistId,
          status: StatusAgendamento.CANCELLED,
        },
      },
    ],
    [
      'especialista',
      {
        appointment_id: 'abababab-abab-4bab-8bab-abababababab',
        appointment: {
          id: 'abababab-abab-4bab-8bab-abababababab',
          client_id: ownerClientId,
          specialist_id: outsiderId,
          status: StatusAgendamento.CANCELLED,
        },
      },
    ],
  ])(
    'não rejeita quando o %s do appointment diverge do processo',
    async (_field, overrides) => {
      const { service, processUpdateMany, historyCreate, rejectionCreate } =
        rejectionService(protectedProcess(overrides));

      await expect(
        service.rejectProcess(
          '99999999-9999-4999-8999-999999999999',
          assignedSpecialistId,
          undefined,
          UserRole.SPECIALIST,
        ),
      ).rejects.toThrow('Agendamento não corresponde aos participantes');

      expect(processUpdateMany).not.toHaveBeenCalled();
      expect(historyCreate).not.toHaveBeenCalled();
      expect(rejectionCreate).not.toHaveBeenCalled();
    },
  );

  it('rejeição perde a CAS sem criar histórico nem motivo', async () => {
    const { service, historyCreate, rejectionCreate, processUpdateMany } =
      rejectionService(protectedProcess(), 0);

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        assignedSpecialistId,
        undefined,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(ConflictException);

    expect(processUpdateMany).toHaveBeenCalledTimes(1);
    expect(historyCreate).not.toHaveBeenCalled();
    expect(rejectionCreate).not.toHaveBeenCalled();
  });

  it('não permite rejeitar processo já concluído', async () => {
    const { service, processUpdate } = rejectionService(
      protectedProcess({ status: ProcessStatus.COMPLETED }),
    );

    await expect(
      service.rejectProcess(
        '99999999-9999-4999-8999-999999999999',
        assignedSpecialistId,
        undefined,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(processUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['completion reason', 'getProcessCompletionReason'],
    ['active contract', 'getByIdWithActiveContract'],
  ])('outsider não pode ler %s', async (_label, method) => {
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(protectedProcess()) },
      processStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({ reason: 'CONTRACT_SIGNED' }),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await expect(
      (service[method] as any)('99999999-9999-4999-8999-999999999999', {
        id: outsiderId,
        role: UserRole.CUSTOMER,
        companyId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['completion reason', 'getProcessCompletionReason'],
    ['active contract', 'getByIdWithActiveContract'],
  ])('OFFICE de outra empresa não pode ler %s', async (_label, method) => {
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(protectedProcess()) },
      processStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({ reason: 'CONTRACT_SIGNED' }),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await expect(
      (service[method] as any)('99999999-9999-4999-8999-999999999999', {
        id: 'office-1',
        role: UserRole.OFFICE,
        companyId: otherCompanyId,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    [UserRole.CONSULTANT, consultantId, null],
    [UserRole.OFFICE, 'office-1', clientCompanyId],
  ])(
    '%s vinculado ao cliente pode ler contrato ativo',
    async (role, id, companyId) => {
      const prisma = {
        process: {
          findUnique: jest.fn().mockResolvedValue(protectedProcess()),
        },
        contract: {
          findUnique: jest.fn().mockResolvedValue({ id: 'contract-1' }),
        },
      } as any;
      const service = new ProcessesService(prisma, {} as any);

      await expect(
        service.getByIdWithActiveContract(
          '99999999-9999-4999-8999-999999999999',
          { id, role, companyId },
        ),
      ).resolves.toEqual(
        expect.objectContaining({ id: protectedProcess().id }),
      );
    },
  );

  it('OFFICE mantém acesso quando o consultor é da empresa, mesmo com vínculo direto legado diferente', async () => {
    const process = protectedProcess({
      client: {
        id: ownerClientId,
        consultant_id: consultantId,
        company_id: otherCompanyId,
        consultant: { company_id: clientCompanyId },
      },
    });
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      contract: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await expect(
      service.getByIdWithActiveContract(process.id, {
        id: 'office-1',
        role: UserRole.OFFICE,
        companyId: clientCompanyId,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: process.id }));
  });
});

describe('ProcessesService.cancelAppointment — serialização canônica', () => {
  it('adquire o lock da agenda e revalida processo/appointment dentro da transação', async () => {
    const process = {
      id: 'process-1',
      client_id: clientId,
      specialist_id: specialistId,
      status: ProcessStatus.SCHEDULING,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      product_type: ProductType.CAR,
      appointment_id: 'appointment-1',
      appointment: {
        id: 'appointment-1',
        client_id: clientId,
        specialist_id: specialistId,
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
      },
      client: {
        id: clientId,
        name: 'Cliente',
        surname: 'Teste',
        email: 'cliente@example.com',
      },
      specialist: {
        id: specialistId,
        name: 'Especialista',
        surname: 'Teste',
        email: 'especialista@example.com',
      },
      car: { marca: 'Porsche', modelo: '911' },
      boat: null,
      aircraft: null,
    };
    const historyDelete = jest.fn().mockResolvedValue({ count: 1 });
    const processClaim = jest.fn().mockResolvedValue({ count: 1 });
    const processDelete = jest.fn().mockResolvedValue(process);
    const appointmentDelete = jest.fn().mockResolvedValue(process.appointment);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest.fn().mockResolvedValue(process),
        updateMany: processClaim,
        delete: processDelete,
      },
      appointment: { delete: appointmentDelete },
      processStatusHistory: { deleteMany: historyDelete },
    };
    const prisma = {
      process: {
        findUnique: jest.fn().mockResolvedValue(process),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const notifications = {
      sendAppointmentCancelledEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProcessesService(prisma, notifications as any);

    await service.cancelAppointment(process.id, clientId);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      `appointment-schedule:${specialistId}`,
    );
    expect(tx.process.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: process.id } }),
    );
    expect(historyDelete).toHaveBeenCalledWith({
      where: { processId: process.id },
    });
    expect(processClaim).toHaveBeenCalledWith({
      where: {
        id: process.id,
        status: ProcessStatus.SCHEDULING,
        updated_at: process.updated_at,
      },
      data: { updated_at: expect.any(Date) },
    });
    expect(processClaim.mock.invocationCallOrder[0]).toBeLessThan(
      historyDelete.mock.invocationCallOrder[0],
    );
    expect(processDelete).toHaveBeenCalledWith({
      where: { id: process.id },
    });
    expect(appointmentDelete).toHaveBeenCalledWith({
      where: { id: process.appointment.id },
    });
  });

  it('não apaga processo SCHEDULING quando o appointment já está COMPLETED', async () => {
    const process = {
      id: 'process-1',
      client_id: clientId,
      specialist_id: specialistId,
      status: ProcessStatus.SCHEDULING,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      appointment_id: 'appointment-1',
      appointment: {
        id: 'appointment-1',
        client_id: clientId,
        specialist_id: specialistId,
        status: StatusAgendamento.COMPLETED,
      },
      client: { id: clientId },
      specialist: { id: specialistId },
      car: null,
      boat: null,
      aircraft: null,
    };
    const processClaim = jest.fn();
    const processDelete = jest.fn();
    const appointmentDelete = jest.fn();
    const historyDelete = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest.fn().mockResolvedValue(process),
        updateMany: processClaim,
        delete: processDelete,
      },
      appointment: { delete: appointmentDelete },
      processStatusHistory: { deleteMany: historyDelete },
    };
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await expect(
      service.cancelAppointment(process.id, clientId),
    ).rejects.toThrow(
      'Apenas agendamentos pendentes ou agendados podem ser cancelados',
    );

    expect(processClaim).not.toHaveBeenCalled();
    expect(historyDelete).not.toHaveBeenCalled();
    expect(processDelete).not.toHaveBeenCalled();
    expect(appointmentDelete).not.toHaveBeenCalled();
  });
});
