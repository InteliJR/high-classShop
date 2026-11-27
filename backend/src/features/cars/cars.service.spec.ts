import { CarsService } from './cars.service';
import { Prisma, ProductCurrency } from '@prisma/client';
import { publicCarSelect } from 'src/shared/selects/public-catalog.select';

describe('CarsService — UUID do produto', () => {
  it('consulta o carro pelo UUID recebido', async () => {
    const carId = '11111111-1111-4111-8111-111111111111';
    const findUnique = jest.fn().mockResolvedValue({
      id: carId,
      valor: new Prisma.Decimal('1500000.01'),
      currency: ProductCurrency.BRL,
      images: [],
    });
    const service = new CarsService({ car: { findUnique } } as any, {} as any);

    const result = await service.findOne(carId);

    expect(result.valor).toBe(1500000.01);
    expect(result.currency).toBe(ProductCurrency.BRL);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: carId },
      select: publicCarSelect,
    });
  });

  it('allows a non-monetary update while the car is in negotiation', async () => {
    const carId = '11111111-1111-4111-8111-111111111111';
    const currentCar = {
      id: carId,
      valor: new Prisma.Decimal('100000.00'),
      currency: ProductCurrency.BRL,
      images: [],
    };
    const findUnique = jest.fn().mockResolvedValue(currentCar);
    const update = jest.fn().mockResolvedValue(currentCar);
    const findFirst = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      car: { findUnique, update },
      process: { findFirst },
    };
    const service = new CarsService(
      {
        car: { findUnique, update },
        process: { findFirst },
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      } as any,
      {} as any,
    );

    await service.update(carId, { modelo: 'Novo modelo' });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: carId },
      data: { modelo: 'Novo modelo' },
    });
  });
});

describe('CarsService — getAllCars (busca e ordenação)', () => {
  function mkService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      car: { findMany, count },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as any;
    const service = new CarsService(prisma, {} as any);
    return { service, findMany, count };
  }

  it('ordena por created_at desc e id asc para paginação estável', async () => {
    const { service, findMany } = mkService();

    await service.getAllCars({ page: 2, perPage: 20, appliedFilters: {} });

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

    await service.getAllCars(
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

    await service.getAllCars({
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

    await service.getAllCars({
      page: 1,
      perPage: 20,
      appliedFilters: { search: '   ' },
    });

    expect(findMany.mock.calls[0][0].where).toEqual({ is_active: true });
  });

  it('limita o termo de busca a 100 caracteres', async () => {
    const { service, findMany } = mkService();

    await service.getAllCars({
      page: 1,
      perPage: 20,
      appliedFilters: { search: 'x'.repeat(150) },
    });

    expect(findMany.mock.calls[0][0].where.OR[0].marca.contains).toHaveLength(
      100,
    );
  });

  it('converte faixas da query em número e filtra preço em `valor`', async () => {
    const { service, findMany } = mkService();

    await service.getAllCars({
      page: 1,
      perPage: 20,
      appliedFilters: {
        ano_min: '2019',
        preco_max: '900000',
        km_max: '30000',
      } as any,
    });

    expect(findMany.mock.calls[0][0].where).toEqual({
      is_active: true,
      ano: { gte: 2019 },
      valor: { lte: 900000 },
      km: { lte: 30000 },
    });
  });
});
