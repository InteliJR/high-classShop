import { SpecialistsService } from './specialists.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('SpecialistsService.inviteSpecialist', () => {
  it('assina a comissão definida pelo administrador', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const jwt = { sign: jest.fn().mockReturnValue('signed-invite') } as any;
    const ses = {
      sendSpecialistInviteEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const notifications = {} as any;
    const service = new SpecialistsService(prisma, jwt, ses, notifications);

    const result = await service.inviteSpecialist({
      email: 'especialista@example.com',
      speciality: 'CAR' as any,
      commission_rate: 25,
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        type: 'SPECIALIST_INVITE',
        email: 'especialista@example.com',
        speciality: 'CAR',
        commission_rate: 25,
      },
      expect.objectContaining({ expiresIn: '7d' }),
    );
    expect(result).toMatchObject({
      email: 'especialista@example.com',
      inviteLink: expect.stringContaining('signed-invite'),
    });
  });
});

describe('SpecialistsService.findAll', () => {
  it('preserva null e zero como estados distintos', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'legacy', commission_rate: null },
          { id: 'zero', commission_rate: 0 },
        ]),
      },
    } as any;
    const service = new SpecialistsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll();

    expect(result.map((item) => item.commission_rate)).toEqual([null, 0]);
  });
});

describe('SpecialistsService.findAllGroupedByCategory', () => {
  it('não seleciona a comissão na resposta consumida por clientes', async () => {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new SpecialistsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAllGroupedByCategory();

    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('commission_rate');
  });
});

describe('SpecialistsService.create', () => {
  const base = {
    name: 'Ana',
    surname: 'Silva',
    email: 'ana@example.com',
    cnpj: '11222333000181',
    rg: '1234567',
    password_hash: 'senha-segura',
    speciality: 'CAR',
  };

  function makeService() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'specialist-1', ...data }),
        ),
      },
    } as any;
    const notifications = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    return {
      prisma,
      service: new SpecialistsService(
        prisma,
        {} as any,
        {} as any,
        notifications,
      ),
    };
  }

  it.each([0, 100])('persiste comissão obrigatória %s', async (commission_rate) => {
    const { prisma, service } = makeService();

    await service.create({ ...base, commission_rate } as any);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ commission_rate }),
    });
  });

  it.each([undefined, null, 12.345, 1e-7])(
    'rejeita comissão inválida %s antes de persistir',
    async (commission_rate) => {
      const { prisma, service } = makeService();

      await expect(
        service.create({ ...base, commission_rate } as any),
      ).rejects.toThrow('Taxa de comissão inválida');
      expect(prisma.user.create).not.toHaveBeenCalled();
    },
  );

  it('normaliza a comissão Decimal para número na resposta', async () => {
    const { prisma, service } = makeService();
    prisma.user.create.mockResolvedValue({
      id: 'specialist-1',
      name: 'Ana',
      surname: 'Silva',
      email: 'ana@example.com',
      role: 'SPECIALIST',
      commission_rate: { toString: () => '12.5' },
    });

    const result = await service.create({
      ...base,
      commission_rate: 12.5,
    } as any);

    expect(result.commission_rate).toBe(12.5);
  });
});
