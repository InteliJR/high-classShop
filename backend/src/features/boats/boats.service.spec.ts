import { BoatsService } from './boats.service';

describe('BoatsService — getAllBoats (busca e ordenação)', () => {
  function mkService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      boat: { findMany, count },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as any;
    const service = new BoatsService(prisma, {} as any);
    return { service, findMany, count };
  }

  it('ordena por created_at desc e id asc para paginação estável', async () => {
    const { service, findMany } = mkService();

    await service.getAllBoats({ page: 2, perPage: 20, appliedFilters: {} });

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

    await service.getAllBoats(
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

    await service.getAllBoats({
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

    await service.getAllBoats({
      page: 1,
      perPage: 20,
      appliedFilters: { search: '   ' },
    });

    expect(findMany.mock.calls[0][0].where).toEqual({ is_active: true });
  });

  it('limita o termo de busca a 100 caracteres', async () => {
    const { service, findMany } = mkService();

    await service.getAllBoats({
      page: 1,
      perPage: 20,
      appliedFilters: { search: 'x'.repeat(150) },
    });

    expect(findMany.mock.calls[0][0].where.OR[0].marca.contains).toHaveLength(
      100,
    );
  });

  it('filtra faixas de ano e preço na direção certa, em `valor` e como número', async () => {
    const { service, findMany } = mkService();

    await service.getAllBoats({
      page: 1,
      perPage: 20,
      // Como chega da query string: texto.
      appliedFilters: {
        ano_min: '2018',
        ano_max: '2022',
        preco_min: '1000000',
        preco_max: '5000000',
      } as any,
    });

    expect(findMany.mock.calls[0][0].where).toEqual({
      is_active: true,
      ano: { gte: 2018, lte: 2022 },
      valor: { gte: 1000000, lte: 5000000 },
    });
  });

  it('ignora limites de faixa vazios ou não numéricos', async () => {
    const { service, findMany } = mkService();

    await service.getAllBoats({
      page: 1,
      perPage: 20,
      appliedFilters: { ano_min: 'abc', preco_max: '' } as any,
    });

    expect(findMany.mock.calls[0][0].where).toEqual({ is_active: true });
  });
});
