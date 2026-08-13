import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { CreateProcessDTO } from './dto/create-process.dto';
import { AssignProductToProcessDto } from './dto/assign-product.dto';
import { ProcessesService } from './processes.service';

const productId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const specialistId = '33333333-3333-4333-8333-333333333333';

describe('ProcessesService — produto UUID', () => {
  it('persiste e consulta o produto pelo UUID sem conversão numérica', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
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
      process: { findFirst },
      $transaction: jest.fn(async (callback) =>
        callback({
          process: { create },
          processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await service.create({
      client_id: clientId,
      specialist_id: specialistId,
      product_type: 'CAR',
      product_id: productId,
    } as unknown as CreateProcessDTO);

    expect(findFirst).toHaveBeenCalledWith({
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

    expect((await validate(createDto)).some((error) => error.property === 'product_id')).toBe(true);
    expect((await validate(assignDto)).some((error) => error.property === 'product_id')).toBe(true);
  });
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
