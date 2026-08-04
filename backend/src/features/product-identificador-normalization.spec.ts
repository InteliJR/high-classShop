import { AircraftsService } from './aircrafts/aircrafts.service';
import { BoatsService } from './boats/boats.service';
import { CarsService } from './cars/cars.service';

const specialistId = '00000000-0000-4000-8000-000000000001';

describe('importação XLSX por identificador', () => {
  it.each([
    ['carro', CarsService, 'car'],
    ['barco', BoatsService, 'boat'],
    ['aeronave', AircraftsService, 'aircraft'],
  ])(
    'normaliza o identificador antes de buscar e criar %s',
    async (_productType, Service, delegateName) => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockResolvedValue({ id: 1 });
      const prisma = { [delegateName]: { findFirst, create } } as any;
      const xlsxImportService = {
        parseWorkbook: jest.fn().mockResolvedValue({
          rows: [
            {
              marca: 'Marca',
              modelo: 'Modelo',
              identificador: '  PRODUTO-001  ',
              valor: '100',
              estado: 'SP',
              ano: '2020',
            },
          ],
          imageMap: new Map(),
        }),
        validateStructure: jest.fn().mockReturnValue({ valid: true }),
        createResponse: jest.fn().mockReturnValue({}),
      } as any;
      const service = new Service(prisma, {} as any, xlsxImportService);

      await service.importFromXlsx(Buffer.alloc(0), { id: specialistId } as any);

      expect(findFirst).toHaveBeenCalledWith({
        where: { specialist_id: specialistId, identificador: 'PRODUTO-001' },
      });
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ identificador: 'PRODUTO-001' }),
      });
    },
  );
});
