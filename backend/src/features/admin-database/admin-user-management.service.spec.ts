import { ConflictException } from '@nestjs/common';
import { ProcessStatus, ProductType, UserRole } from '@prisma/client';
import { AdminUserManagementService } from './admin-user-management.service';

const customerId = '11111111-1111-4111-8111-111111111111';
const specialistId = '22222222-2222-4222-8222-222222222222';
const officeId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const companyId = '55555555-5555-4555-8555-555555555555';

type User = {
  id: string;
  role: UserRole;
  is_active: boolean;
  consultant_id?: string | null;
  company_id?: string | null;
  speciality?: ProductType | null;
};

function user(id: string, role: UserRole, overrides: Partial<User> = {}): User {
  return {
    id,
    role,
    is_active: true,
    consultant_id: null,
    company_id: null,
    speciality: null,
    ...overrides,
  };
}

function makePrisma(users: User[] = [user(customerId, UserRole.CUSTOMER)]) {
  const transactionUser = {
    findUnique: jest.fn(
      async ({ where }) =>
        users.find((candidate) => candidate.id === where.id) ?? null,
    ),
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn(async ({ where }) =>
      where?.role === UserRole.ADMIN && where?.is_active === true
        ? users.filter(
            (candidate) =>
              candidate.role === UserRole.ADMIN && candidate.is_active,
          ).length
        : 0,
    ),
    update: jest.fn().mockResolvedValue({}),
  };
  const tx = {
    user: transactionUser,
    company: { findUnique: jest.fn().mockResolvedValue({ id: companyId }) },
    customerAdvisor: { count: jest.fn().mockResolvedValue(0) },
    car: { count: jest.fn().mockResolvedValue(0) },
    boat: { count: jest.fn().mockResolvedValue(0) },
    aircraft: { count: jest.fn().mockResolvedValue(0) },
    appointment: { count: jest.fn().mockResolvedValue(0) },
    process: { count: jest.fn().mockResolvedValue(0) },
  };
  return {
    ...tx,
    $transaction: jest.fn(async (callback) => callback(tx)),
    transactionUser,
  } as any;
}

function makeService(users?: User[]) {
  const prisma = makePrisma(users);
  return { prisma, service: new AdminUserManagementService(prisma) };
}

describe('AdminUserManagementService', () => {
  it('exige escritório para Consultor', async () => {
    const { service } = makeService();

    await expect(
      service.validateRoleChange(customerId, { role: UserRole.CONSULTANT }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [{ code: 'COMPANY_REQUIRED' }],
    });
  });

  it('exige especialidade para Especialista', async () => {
    const { service } = makeService();

    await expect(
      service.validateRoleChange(customerId, { role: UserRole.SPECIALIST }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [{ code: 'SPECIALITY_REQUIRED' }],
    });
  });

  it('atualiza promoção válida na transação serializável', async () => {
    const { prisma, service } = makeService();

    await service.changeRole(customerId, {
      role: UserRole.SPECIALIST,
      speciality: ProductType.AIRCRAFT,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(prisma.transactionUser.update).toHaveBeenCalledWith({
      where: { id: customerId },
      data: { role: UserRole.SPECIALIST, speciality: ProductType.AIRCRAFT },
    });
  });

  it.each([
    [
      'CUSTOMER_HAS_CONSULTANT',
      user(customerId, UserRole.CUSTOMER, { consultant_id: officeId }),
      { role: UserRole.CONSULTANT, company_id: companyId },
    ],
    [
      'CUSTOMER_HAS_ADVISOR',
      user(customerId, UserRole.CUSTOMER),
      { role: UserRole.CONSULTANT, company_id: companyId },
    ],
    [
      'CONSULTANT_HAS_CLIENTS',
      user(customerId, UserRole.CONSULTANT),
      { role: UserRole.CUSTOMER },
    ],
    [
      'CONSULTANT_HAS_ADVISEES',
      user(customerId, UserRole.CONSULTANT),
      { role: UserRole.CUSTOMER },
    ],
    [
      'SPECIALIST_HAS_ACTIVE_PRODUCTS',
      user(specialistId, UserRole.SPECIALIST),
      { role: UserRole.CUSTOMER },
    ],
    [
      'SPECIALIST_HAS_PENDING_APPOINTMENTS',
      user(specialistId, UserRole.SPECIALIST),
      { role: UserRole.CUSTOMER },
    ],
    [
      'SPECIALIST_HAS_OPEN_PROCESSES',
      user(specialistId, UserRole.SPECIALIST),
      { role: UserRole.CUSTOMER },
    ],
    [
      'LAST_ACTIVE_ADMIN',
      user(customerId, UserRole.ADMIN),
      { role: UserRole.CUSTOMER },
    ],
  ] as const)(
    'bloqueia %s e devolve mensagem em português',
    async (code, subject, request) => {
      const { prisma, service } = makeService([subject]);

      if (
        code === 'CUSTOMER_HAS_ADVISOR' ||
        code === 'CONSULTANT_HAS_ADVISEES'
      ) {
        prisma.customerAdvisor.count.mockResolvedValue(1);
      }
      if (code === 'CONSULTANT_HAS_CLIENTS')
        prisma.user.count.mockResolvedValue(1);
      if (code === 'SPECIALIST_HAS_ACTIVE_PRODUCTS')
        prisma.car.count.mockResolvedValue(1);
      if (code === 'SPECIALIST_HAS_PENDING_APPOINTMENTS')
        prisma.appointment.count.mockResolvedValue(1);
      if (code === 'SPECIALIST_HAS_OPEN_PROCESSES')
        prisma.process.count.mockResolvedValue(1);

      const result = await service.validateRoleChange(subject.id, request);
      const blocker = result.blockers.find((item) => item.code === code);

      expect(result.allowed).toBe(false);
      expect(blocker).toEqual(
        expect.objectContaining({
          code,
          message: expect.stringMatching(/[À-ÿa-z]/i),
        }),
      );
    },
  );

  it('rejeita cargo sem mudança e informa o motivo em português', async () => {
    const { service } = makeService();

    await expect(
      service.validateRoleChange(customerId, { role: UserRole.CUSTOMER }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [
        {
          code: 'ROLE_UNCHANGED',
          message: 'O cargo selecionado já está atribuído a este usuário.',
        },
      ],
    });
  });

  it('troca gerente e substituto na mesma transação', async () => {
    const currentManager = user(officeId, UserRole.OFFICE, {
      company_id: companyId,
    });
    const candidate = user(candidateId, UserRole.CUSTOMER);
    const { prisma, service } = makeService([currentManager, candidate]);
    prisma.transactionUser.findFirst.mockResolvedValue(currentManager);

    await service.changeRole(candidateId, {
      role: UserRole.OFFICE,
      company_id: companyId,
      replacement: { role: UserRole.CONSULTANT, company_id: companyId },
    });

    expect(prisma.transactionUser.update).toHaveBeenNthCalledWith(1, {
      where: { id: officeId },
      data: { role: UserRole.CONSULTANT, company_id: companyId },
    });
    expect(prisma.transactionUser.update).toHaveBeenNthCalledWith(2, {
      where: { id: candidateId },
      data: { role: UserRole.OFFICE, company_id: companyId },
    });
  });

  it('bloqueia gerente saindo do cargo fora de uma substituição atômica', async () => {
    const manager = user(officeId, UserRole.OFFICE, {
      company_id: companyId,
    });
    const { service } = makeService([manager]);

    await expect(
      service.validateRoleChange(officeId, { role: UserRole.CUSTOMER }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [
        {
          code: 'OFFICE_REPLACEMENT_REQUIRED',
          message: 'Informe o novo cargo do gerente atual do escritório.',
        },
      ],
    });
  });

  it.each([
    {
      name: 'Cliente',
      subject: user(customerId, UserRole.CONSULTANT),
      dto: {
        role: UserRole.CUSTOMER,
        company_id: companyId,
        speciality: ProductType.BOAT,
      },
      data: { role: UserRole.CUSTOMER },
    },
    {
      name: 'Administrador',
      subject: user(customerId, UserRole.CUSTOMER),
      dto: {
        role: UserRole.ADMIN,
        company_id: companyId,
        speciality: ProductType.BOAT,
      },
      data: { role: UserRole.ADMIN },
    },
    {
      name: 'Consultor',
      subject: user(customerId, UserRole.CUSTOMER),
      dto: {
        role: UserRole.CONSULTANT,
        company_id: companyId,
        speciality: ProductType.BOAT,
      },
      data: { role: UserRole.CONSULTANT, company_id: companyId },
    },
    {
      name: 'Gerente de escritório',
      subject: user(customerId, UserRole.CUSTOMER),
      dto: {
        role: UserRole.OFFICE,
        company_id: companyId,
        speciality: ProductType.BOAT,
      },
      data: { role: UserRole.OFFICE, company_id: companyId },
    },
    {
      name: 'Especialista',
      subject: user(customerId, UserRole.CUSTOMER),
      dto: {
        role: UserRole.SPECIALIST,
        company_id: companyId,
        speciality: ProductType.AIRCRAFT,
      },
      data: { role: UserRole.SPECIALIST, speciality: ProductType.AIRCRAFT },
    },
  ])(
    'persiste somente o contexto permitido para $name',
    async ({ subject, dto, data }) => {
      const { prisma, service } = makeService([subject]);

      await service.changeRole(subject.id, dto);

      expect(prisma.transactionUser.update).toHaveBeenLastCalledWith({
        where: { id: subject.id },
        data,
      });
    },
  );

  it.each(['car', 'boat', 'appointment', 'process'] as const)(
    'bloqueia especialidade com %s incompatível',
    async (resource) => {
      const { prisma, service } = makeService([
        user(specialistId, UserRole.SPECIALIST, {
          speciality: ProductType.CAR,
        }),
      ]);
      prisma[resource].count.mockResolvedValue(1);

      await expect(
        service.validateSpecialityChange(specialistId, {
          speciality: ProductType.AIRCRAFT,
        }),
      ).resolves.toMatchObject({
        allowed: false,
        blockers: [{ code: expect.any(String) }],
      });
    },
  );

  it('permite especialidade com aeronaves ativas compatíveis com o destino', async () => {
    const { prisma, service } = makeService([
      user(specialistId, UserRole.SPECIALIST, { speciality: ProductType.CAR }),
    ]);
    prisma.aircraft.count.mockResolvedValue(1);

    await expect(
      service.validateSpecialityChange(specialistId, {
        speciality: ProductType.AIRCRAFT,
      }),
    ).resolves.toMatchObject({ allowed: true, blockers: [] });
    expect(prisma.aircraft.count).not.toHaveBeenCalled();
  });

  it('permite especialidade com agendamento PENDING compatível com o destino', async () => {
    const { prisma, service } = makeService([
      user(specialistId, UserRole.SPECIALIST, { speciality: ProductType.CAR }),
    ]);
    prisma.appointment.count.mockImplementation(({ where }) =>
      where.OR ? 0 : 1,
    );

    await expect(
      service.validateSpecialityChange(specialistId, {
        speciality: ProductType.AIRCRAFT,
      }),
    ).resolves.toMatchObject({ allowed: true, blockers: [] });
    expect(prisma.appointment.count).toHaveBeenCalledWith({
      where: {
        specialist_id: specialistId,
        status: 'PENDING',
        OR: [
          { product_type: { not: ProductType.AIRCRAFT } },
          { product_type: null },
        ],
      },
    });
  });

  it('bloqueia especialidade quando há agendamento PENDING sem tipo de produto', async () => {
    const { prisma, service } = makeService([
      user(specialistId, UserRole.SPECIALIST, { speciality: ProductType.CAR }),
    ]);
    prisma.appointment.count.mockImplementation(({ where }) =>
      where.OR?.some((condition) => condition.product_type === null) ? 1 : 0,
    );

    await expect(
      service.validateSpecialityChange(specialistId, {
        speciality: ProductType.AIRCRAFT,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [{ code: 'SPECIALIST_HAS_PENDING_APPOINTMENTS' }],
    });
  });

  it('bloqueia especialidade quando há processo aberto sem tipo de produto', async () => {
    const { prisma, service } = makeService([
      user(specialistId, UserRole.SPECIALIST, { speciality: ProductType.CAR }),
    ]);
    prisma.process.count.mockImplementation(({ where }) =>
      where.OR?.some((condition) => condition.product_type === null) ? 1 : 0,
    );

    await expect(
      service.validateSpecialityChange(specialistId, {
        speciality: ProductType.AIRCRAFT,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      blockers: [{ code: 'SPECIALIST_HAS_OPEN_PROCESSES' }],
    });
  });

  it('permite especialidade quando há somente processos concluídos ou rejeitados', async () => {
    const { prisma, service } = makeService([
      user(specialistId, UserRole.SPECIALIST, { speciality: ProductType.CAR }),
    ]);

    await expect(
      service.validateSpecialityChange(specialistId, {
        speciality: ProductType.AIRCRAFT,
      }),
    ).resolves.toMatchObject({ allowed: true, blockers: [] });
    expect(prisma.process.count).toHaveBeenCalledWith({
      where: {
        specialist_id: specialistId,
        status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
        OR: [
          { product_type: { not: ProductType.AIRCRAFT } },
          { product_type: null },
        ],
      },
    });
  });

  it('revalida e bloqueia a mutação quando a transação encontra um conflito', async () => {
    const { prisma, service } = makeService([
      user(customerId, UserRole.CUSTOMER, { consultant_id: officeId }),
    ]);

    await expect(
      service.changeRole(customerId, {
        role: UserRole.CONSULTANT,
        company_id: companyId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.transactionUser.update).not.toHaveBeenCalled();
  });

  it('traduz conflito único de gerente em bloqueio de escritório em português', async () => {
    const { prisma, service } = makeService();
    prisma.$transaction.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'one_office_per_company' },
    });

    await expect(
      service.changeRole(customerId, {
        role: UserRole.OFFICE,
        company_id: companyId,
      }),
    ).rejects.toMatchObject({
      response: {
        blockers: [
          {
            code: 'OFFICE_CONFLICT',
            message: 'O escritório já possui um gerente ativo.',
          },
        ],
      },
    });
  });

  it.each([
    {
      name: 'cargo',
      mutate: (service: AdminUserManagementService) =>
        service.changeRole(customerId, {
          role: UserRole.CONSULTANT,
          company_id: companyId,
        }),
    },
    {
      name: 'especialidade',
      mutate: (service: AdminUserManagementService) =>
        service.changeSpeciality(specialistId, {
          speciality: ProductType.BOAT,
        }),
    },
  ])(
    'traduz P2034 ao confirmar alteração de $name em conflito localizado',
    async ({ mutate }) => {
      const { prisma, service } = makeService([
        user(customerId, UserRole.CUSTOMER),
        user(specialistId, UserRole.SPECIALIST, {
          speciality: ProductType.CAR,
        }),
      ]);
      prisma.$transaction.mockRejectedValue({ code: 'P2034' });

      await expect(mutate(service)).rejects.toMatchObject({
        status: 409,
        response: {
          allowed: false,
          summary: 'A alteração não pode ser concluída.',
          blockers: [
            {
              code: 'CONCURRENT_CHANGE',
              message:
                'Outra alteração foi concluída ao mesmo tempo. Verifique os dados e tente novamente.',
            },
          ],
        },
      });
    },
  );
});
