import { BoatsController } from './boats.controller';

function mkController(connection: { is_active: boolean } | null) {
  const boatsService = {
    create: jest.fn().mockResolvedValue({ id: 'boat-1' }),
  } as any;
  const productImportJobsService = {} as any;
  const prisma = {
    calendlyConnection: {
      findUnique: jest.fn().mockResolvedValue(connection),
    },
  } as any;
  const controller = new BoatsController(
    boatsService,
    productImportJobsService,
    prisma,
  );
  return { controller, boatsService, prisma };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'BOAT',
} as any;

describe('BoatsController.create — gate Calendly', () => {
  it('bloqueia criação quando o especialista não tem Calendly conectado', async () => {
    const { controller, boatsService } = mkController(null);

    await expect(controller.create({} as any, specialist)).rejects.toThrow(
      /Calendly/,
    );
    expect(boatsService.create).not.toHaveBeenCalled();
  });

  it('permite criação quando o Calendly está conectado', async () => {
    const { controller, boatsService } = mkController({ is_active: true });

    await expect(controller.create({} as any, specialist)).resolves.toEqual({
      id: 'boat-1',
    });
    expect(boatsService.create).toHaveBeenCalled();
  });
});
