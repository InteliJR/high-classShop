import { ForbiddenException } from '@nestjs/common';
import { StatusAgendamento, UserRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService.getAppointments — escopo de visibilidade', () => {
  function harness(companyId: string | null = 'company-a') {
    const count = jest.fn().mockResolvedValue(3);
    const findMany = jest.fn().mockResolvedValue([]);
    const groupBy = jest.fn().mockResolvedValue([
      { status: StatusAgendamento.SCHEDULED, _count: 2 },
      { status: StatusAgendamento.COMPLETED, _count: 1 },
    ]);
    const userFindUnique = jest.fn().mockResolvedValue({ company_id: companyId });
    const prisma = {
      user: { findUnique: userFindUnique },
      appointment: { count, findMany, groupBy },
    } as any;

    return {
      service: new AppointmentsService(prisma, {} as any, {} as any),
      count,
      findMany,
      groupBy,
      userFindUnique,
    };
  }

  it.each(['company-a', 'company-b'])(
    'restringe OFFICE aos clientes vinculados à própria empresa (%s)',
    async (companyId) => {
      const { service, count, findMany, groupBy, userFindUnique } =
        harness(companyId);

      const result = await service.getAppointments(
        { page: 2, limit: 2, client_id: 'requested-client' },
        'office-user',
        UserRole.OFFICE,
      );

      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: 'office-user' },
        select: { company_id: true },
      });

      const tenantScope = {
        client: {
          role: UserRole.CUSTOMER,
          OR: [
            { consultant: { company_id: companyId } },
            { company_id: companyId },
          ],
        },
      };
      const expectedWhere = {
        AND: [tenantScope],
        client_id: 'requested-client',
      };

      expect(count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 2,
          take: 2,
        }),
      );
      expect(groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [],
          meta: {
            pagination: {
              current_page: 2,
              per_page: 2,
              total: 3,
              total_pages: 2,
              has_next: false,
              has_prev: true,
            },
            summary: { upcoming: 2, completed: 1, cancelled: 0 },
          },
        }),
      );
    },
  );

  it('barra OFFICE sem company_id antes de consultar agendamentos', async () => {
    const { service, count, findMany, groupBy } = harness(null);

    await expect(
      service.getAppointments({}, 'office-without-company', UserRole.OFFICE),
    ).rejects.toThrow(ForbiddenException);

    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('barra papel desconhecido por padrão', async () => {
    const { service, userFindUnique, count } = harness();

    await expect(
      service.getAppointments({}, 'unknown-user', 'NEW_ROLE' as UserRole),
    ).rejects.toThrow(ForbiddenException);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it.each([
    [UserRole.CUSTOMER, 'customer-user', { client_id: 'customer-user' }],
    [
      UserRole.SPECIALIST,
      'specialist-user',
      {
        OR: [
          { specialist_id: 'specialist-user' },
          { client_id: 'specialist-user' },
        ],
      },
    ],
    [
      UserRole.CONSULTANT,
      'consultant-user',
      {
        OR: [
          { specialist_id: 'consultant-user' },
          { client_id: 'consultant-user' },
        ],
      },
    ],
  ])('preserva o escopo de %s', async (role, userId, expectedWhere) => {
    const { service, userFindUnique, count, findMany, groupBy } = harness();

    await service.getAppointments({}, userId, role as UserRole);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });

  it('preserva a visão global e a resposta paginada do ADMIN', async () => {
    const { service, userFindUnique, count, findMany, groupBy } = harness();

    const result = await service.getAppointments(
      { page: 1, limit: 20 },
      'admin-user',
      UserRole.ADMIN,
    );

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(result.meta.pagination).toEqual({
      current_page: 1,
      per_page: 20,
      total: 3,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    });
  });
});
