import { ProductImportJobsService } from './product-import-jobs.service';

describe('ProductImportJobsService', () => {
  it('busca produto existente por (specialist_id, identificador), nao por modelo', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'uuid-1' });
    const prisma = { car: { findFirst, create } } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);

    await (service as any).upsertProductFromRow(
      'CAR',
      {
        marca: 'Ferrari',
        modelo: 'X',
        identificador: 'FERRARI-X-2',
        valor: '100',
        estado: 'SP',
        ano: '2020',
      },
      '00000000-0000-4000-8000-000000000001',
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        specialist_id: '00000000-0000-4000-8000-000000000001',
        identificador: 'FERRARI-X-2',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ identificador: 'FERRARI-X-2' }),
    });
  });
});
