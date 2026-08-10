import { ProductType } from '@prisma/client';
import { ProductImportJobsService } from './product-import-jobs/product-import-jobs.service';

const specialistId = '00000000-0000-4000-8000-000000000001';

const baseRow = {
  marca: 'Marca',
  modelo: 'Modelo',
  valor: '100',
  estado: 'SP',
  ano: '2020',
};

// `upsertProductFromRow` é privado, mas é o único ponto onde o identificador é
// normalizado — testar via `createJobFromCsv` exigiria simular o job inteiro.
const upsert = (
  service: ProductImportJobsService,
  productType: ProductType,
  row: Record<string, string>,
) => (service as any).upsertProductFromRow(productType, row, specialistId);

describe('normalização do identificador no import', () => {
  const build = (delegate: string) => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'novo-id' });
    const prisma = { [delegate]: { findFirst, create } } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    // a validação de DTO não é o alvo aqui
    jest.spyOn(service as any, 'validatePayload').mockResolvedValue(undefined);
    return { service, findFirst, create };
  };

  it.each([
    ['carro', ProductType.CAR, 'car'],
    ['barco', ProductType.BOAT, 'boat'],
    ['aeronave', ProductType.AIRCRAFT, 'aircraft'],
  ])(
    'busca e grava o identificador com trim (%s)',
    async (_label, productType, delegate) => {
      const { service, findFirst, create } = build(delegate);

      await upsert(service, productType, {
        ...baseRow,
        identificador: '  PRODUTO-001  ',
      });

      expect(findFirst).toHaveBeenCalledWith({
        where: { specialist_id: specialistId, identificador: 'PRODUTO-001' },
      });
      // busca e gravação precisam usar o MESMO valor: se gravar sem trim, o
      // reimport não reencontra o produto e cria duplicata
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ identificador: 'PRODUTO-001' }),
      });
    },
  );

  it.each([
    ['carro', ProductType.CAR, 'car'],
    ['barco', ProductType.BOAT, 'boat'],
    ['aeronave', ProductType.AIRCRAFT, 'aircraft'],
  ])(
    'rejeita identificador só com espaço (%s)',
    async (_label, productType, delegate) => {
      const { service, create } = build(delegate);

      await expect(
        upsert(service, productType, { ...baseRow, identificador: '   ' }),
      ).rejects.toThrow(/identificador/i);
      expect(create).not.toHaveBeenCalled();
    },
  );
});
