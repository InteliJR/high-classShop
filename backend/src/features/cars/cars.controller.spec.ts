import { CarsController } from './cars.controller';

function mkController(connection: { is_active: boolean } | null) {
  const carsService = {
    create: jest.fn().mockResolvedValue({ id: 'car-1' }),
  } as any;
  const productImportJobsService = {} as any;
  const prisma = {
    calendlyConnection: {
      findUnique: jest.fn().mockResolvedValue(connection),
    },
  } as any;
  const controller = new CarsController(
    carsService,
    productImportJobsService,
    prisma,
  );
  return { controller, carsService, prisma };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'CAR',
} as any;

describe('CarsController.create — gate Calendly', () => {
  it('bloqueia criação quando o especialista não tem Calendly conectado', async () => {
    const { controller, carsService } = mkController(null);

    await expect(controller.create({} as any, specialist)).rejects.toThrow(
      /Calendly/,
    );
    expect(carsService.create).not.toHaveBeenCalled();
  });

  it('permite criação quando o Calendly está conectado', async () => {
    const { controller, carsService } = mkController({ is_active: true });

    await expect(controller.create({} as any, specialist)).resolves.toEqual({
      id: 'car-1',
    });
    expect(carsService.create).toHaveBeenCalled();
  });
});
