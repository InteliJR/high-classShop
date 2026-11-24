import { AircraftsService } from './aircrafts.service';

describe('AircraftsService — getAllAircrafts (busca e ordenação)', () => {
  function mkService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      aircraft: { findMany, count },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as any;
    const service = new AircraftsService(prisma, {} as any);
    return { service, findMany, count };
  }

  it('ordena por created_at desc e id asc para paginação estável', async () => {
    const { service, findMany } = mkService();

    await service.getAllAircrafts({ page: 2, perPage: 20, appliedFilters: {} });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      }),
    );
  });

  it('busca em marca/modelo (insensitive) sem ano quando o termo não é um ano', async () => {
    const { service, findMany, count } = mkService();

    await service.getAllAircrafts(
      {
        page: 1,
        perPage: 20,
        appliedFilters: { search: '  Fer  ', specialist_id: 'spec-1' },
      },
      true,
    );

    const expectedWhere = {
      specialist_id: 'spec-1',
      OR: [
        { marca: { contains: 'Fer', mode: 'insensitive' } },
        { modelo: { contains: 'Fer', mode: 'insensitive' } },

        { estado: { contains: 'Fer', mode: 'insensitive' } },
      ],
    };
    expect(findMany.mock.calls[0][0].where).toEqual(expectedWhere);
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('inclui ano exato quando o termo tem 4 dígitos', async () => {
    const { service, findMany } = mkService();

    await service.getAllAircrafts({
      page: 1,
      perPage: 20,
      appliedFilters: { search: '2021' },
    });

    expect(findMany.mock.calls[0][0].where).toEqual({
      is_active: true,
      OR: [
        { marca: { contains: '2021', mode: 'insensitive' } },
        { modelo: { contains: '2021', mode: 'insensitive' } },

        { estado: { contains: '2021', mode: 'insensitive' } },
        { ano: 2021 },
      ],
    });
  });

  it('ignora busca vazia ou só com espaços', async () => {
    const { service, findMany } = mkService();

    await service.getAllAircrafts({
      page: 1,
      perPage: 20,
      appliedFilters: { search: '   ' },
    });

    expect(findMany.mock.calls[0][0].where).toEqual({ is_active: true });
  });

  it('limita o termo de busca a 100 caracteres', async () => {
    const { service, findMany } = mkService();

    await service.getAllAircrafts({
      page: 1,
      perPage: 20,
      appliedFilters: { search: 'x'.repeat(150) },
    });

    expect(findMany.mock.calls[0][0].where.OR[0].marca.contains).toHaveLength(
      100,
    );
  });
});
