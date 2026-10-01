import { ProductType } from '@prisma/client';
import { CarsController } from './cars.controller';

function mkController() {
  const carsService = {
    create: jest.fn().mockResolvedValue({ id: 'car-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new CarsController(carsService, productImportJobsService);
  return { controller, carsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'CAR',
} as any;

describe('CarsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, carsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'car-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(carsService.create).toHaveBeenCalledWith(dto);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'carros.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.CAR,
    );
  });
});
