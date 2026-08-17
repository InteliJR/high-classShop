import { AuthService } from './auth.service';

function mkPrisma(company: any) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'u1',
        ...data,
      })),
    },
    company: { findUnique: jest.fn().mockResolvedValue(company) },
  } as any;
}

function mkSvc(prisma: any) {
  // demais deps não são usadas no caminho de register feliz
  const svc = new AuthService(prisma, {} as any, {} as any, {} as any);
  // queueWelcomeEmail é fire-and-forget; stub pra não tocar SES
  (svc as any).queueWelcomeEmail = jest.fn();
  return svc;
}

const baseData = {
  name: 'Ana',
  surname: 'Silva',
  email: 'ana@x.com',
  cpf: '12345678901',
  rg: '1234567',
  phone: '11999998888',
  password: 'secret123',
};

describe('AuthService.register — vínculo whitelabel', () => {
  it('seta company_id quando company_slug resolve', async () => {
    const prisma = mkPrisma({ id: 'c1' });
    const svc = mkSvc(prisma);

    await svc.register({ ...baseData, company_slug: 'alpha-co' } as any);

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { slug: 'alpha-co' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company_id: 'c1' }),
      }),
    );
  });

  it('cadastra sem vínculo quando o slug não existe', async () => {
    const prisma = mkPrisma(null);
    const svc = mkSvc(prisma);

    await svc.register({ ...baseData, company_slug: 'inexistente' } as any);

    const createArg = prisma.user.create.mock.calls[0][0];
    expect(createArg.data.company_id).toBeUndefined();
  });
});

describe('AuthService.registerSpecialist — auto-login', () => {
  const specialistDto = {
    invite_token: 'invite-token',
    name: 'Bruno',
    surname: 'Reis',
    cnpj: '12345678000199',
    rg: '70612235297',
    phone: '11999998888',
    password: 'Senha123',
    civil_state: 'SINGLE',
  } as any;

  function mkSpecialistPrisma() {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'spec-1',
          ...data,
        })),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    } as any;
  }

  function mkJwt() {
    return {
      verify: jest.fn().mockReturnValue({
        type: 'SPECIALIST_INVITE',
        email: 'bruno@example.com',
        speciality: 'CAR',
      }),
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    } as any;
  }

  beforeAll(() => {
    process.env.JWT_SECRET_REFERRAL = 'ref-secret';
    process.env.JWT_SECRET_ACCESS = 'access-secret';
    process.env.JWT_SECRET_REFRESH = 'refresh-secret';
  });

  it('emite accessToken e refreshToken (auto-login) ao criar a conta', async () => {
    const prisma = mkSpecialistPrisma();
    const jwt = mkJwt();
    const svc = new AuthService(prisma, jwt, {} as any, {} as any);
    (svc as any).queueWelcomeEmail = jest.fn();

    const result = await svc.registerSpecialist(specialistDto);

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: 'spec-1' }),
      }),
    );
  });
});
