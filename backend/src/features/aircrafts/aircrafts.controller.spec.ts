import { AircraftsController } from './aircrafts.controller';

function mkController(connection: { is_active: boolean } | null) {
  const aircraftsService = {
    create: jest.fn().mockResolvedValue({ id: 'aircraft-1' }),
  } as any;
  const productImportJobsService = {} as any;
  const prisma = {
    calendlyConnection: {
      findUnique: jest.fn().mockResolvedValue(connection),
    },
  } as any;
  const controller = new AircraftsController(
    aircraftsService,
    productImportJobsService,
    prisma,
  );
  return { controller, aircraftsService, prisma };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'AIRCRAFT',
} as any;

describe('AircraftsController.create — gate Calendly', () => {
  it('bloqueia criação quando o especialista não tem Calendly conectado', async () => {
    const { controller, aircraftsService } = mkController(null);

    await expect(controller.create({} as any, specialist)).rejects.toThrow(
      /Calendly/,
    );
    expect(aircraftsService.create).not.toHaveBeenCalled();
  });

  it('permite criação quando o Calendly está conectado', async () => {
    const { controller, aircraftsService } = mkController({
      is_active: true,
    });

    await expect(controller.create({} as any, specialist)).resolves.toEqual({
      id: 'aircraft-1',
    });
    expect(aircraftsService.create).toHaveBeenCalled();
  });
});
