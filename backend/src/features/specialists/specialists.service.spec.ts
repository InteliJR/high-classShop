import { SpecialistsService } from './specialists.service';

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
