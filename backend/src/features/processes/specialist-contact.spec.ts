import { ForbiddenException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  ProcessStatus,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { ProcessesService } from './processes.service';

function fixture() {
  return {
    id: 'process-1',
    client_id: 'client-1',
    specialist_id: 'process-specialist',
    status: ProcessStatus.SCHEDULING,
    product_type: ProductType.CAR as ProductType | null,
    car_id: 'car-1',
    client: {
      id: 'client-1',
      name: 'Cliente',
      consultant_id: 'consultant-1',
      company_id: 'office-1',
    },
    specialist: {
      id: 'process-specialist',
      name: 'Ana',
      surname: 'Silva',
      speciality: ProductType.CAR,
      email: 'ana@example.test' as string | null,
      phone: '11987654321' as string | null,
    },
    appointment: {
      status: StatusAgendamento.SCHEDULED,
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      appointment_datetime: new Date('2026-11-01T15:00:00Z'),
    } as {
      status: StatusAgendamento;
      scheduling_method: AppointmentSchedulingMethod;
      appointment_datetime: Date;
    } | null,
    // A transferred listing must never replace the specialist of this process.
    car: {
      id: 'car-1',
      marca: 'Porsche',
      modelo: '911',
      specialist_id: 'current-listing-specialist',
      specialist: { email: 'wrong@example.test', phone: '11900000000' },
    },
    notes: null,
    created_at: new Date('2026-10-25T00:00:00Z'),
  };
}

function serviceFor(record = fixture()) {
  const prisma = {
    process: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(record),
      findMany: jest.fn().mockResolvedValue([record]),
      count: jest.fn().mockResolvedValue(1),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role: UserRole.CUSTOMER,
        consultant_id: 'consultant-1',
      }),
    },
  };
  return new ProcessesService(prisma as any, {} as any);
}

async function list(service: ProcessesService, id = 'client-1', role = 'CUSTOMER') {
  const result = await service.getByClientId(
    'client-1',
    { page: 1, perPage: 20 } as any,
    id,
    role,
  );
  return result.processes[0];
}

describe('Specialist contact in owned processes', () => {
  it.each([
    ['EMAIL', 'product', 'SCHEDULED'],
    ['EMAIL', 'product', 'COMPLETED'],
    ['EMAIL', 'consultancy', 'SCHEDULED'],
    ['EMAIL', 'consultancy', 'COMPLETED'],
    ['CALENDLY', 'product', 'SCHEDULED'],
    ['CALENDLY', 'product', 'COMPLETED'],
    ['CALENDLY', 'consultancy', 'SCHEDULED'],
    ['CALENDLY', 'consultancy', 'COMPLETED'],
  ])('returns assigned specialist in list and detail for %s %s %s', async (method, type, status) => {
    const record = fixture();
    record.appointment!.scheduling_method = method as AppointmentSchedulingMethod;
    record.appointment!.status = status as StatusAgendamento;
    if (type === 'consultancy') record.product_type = null;
    const service = serviceFor(record);
    const expected = {
      id: 'process-specialist',
      name: 'Ana',
      surname: 'Silva',
      especialidade: 'CAR',
      email: 'ana@example.test',
      phone: '11987654321',
    };

    expect((await list(service)).specialist).toEqual(expected);
    expect((await service.getById(record.id, 'client-1', UserRole.CUSTOMER)).specialist).toEqual(expected);
    // A second read uses persisted relationships rather than creation response state.
    expect((await list(serviceFor(record))).specialist).toEqual(expected);
  });

  it.each(Object.values(ProcessStatus).filter((status) => status !== ProcessStatus.REJECTED))(
    'keeps confirmed contacts during %s',
    async (status) => {
      const record = fixture();
      record.status = status;
      expect((await list(serviceFor(record))).specialist.email).toBe('ana@example.test');
    },
  );

  it.each(['PENDING', 'CANCELLED', null])('hides private contacts for appointment %s', async (status) => {
    const record = fixture();
    if (status) record.appointment!.status = status as StatusAgendamento;
    else record.appointment = null;
    const service = serviceFor(record);
    for (const response of [await list(service), await service.getById(record.id, 'client-1', UserRole.CUSTOMER)]) {
      expect(response.specialist.email).toBeNull();
      expect(response.specialist.phone).toBeNull();
    }
  });

  it.each([StatusAgendamento.SCHEDULED, StatusAgendamento.COMPLETED])(
    'hides private contacts in rejected process even with %s appointment',
    async (status) => {
      const record = fixture();
      record.status = ProcessStatus.REJECTED;
      record.appointment!.status = status;
      const service = serviceFor(record);
      for (const response of [await list(service), await service.getById(record.id, 'client-1', UserRole.CUSTOMER)]) {
        expect(response.specialist.email).toBeNull();
        expect(response.specialist.phone).toBeNull();
      }
    },
  );

  it.each([
    [UserRole.ADMIN, 'admin-1'],
    [UserRole.CONSULTANT, 'consultant-1'],
    [UserRole.SPECIALIST, 'process-specialist'],
  ])('does not disclose specialist contact to %s with process access', async (role, id) => {
    const service = serviceFor();
    for (const response of [await list(service, id, role), await service.getById('process-1', id, role)]) {
      expect(response.specialist.email).toBeNull();
      expect(response.specialist.phone).toBeNull();
    }
  });

  it('does not disclose private contacts to the related office', async () => {
    const result = await serviceFor().getById('process-1', 'office-manager', UserRole.OFFICE, 'office-1');
    expect(result.specialist.email).toBeNull();
    expect(result.specialist.phone).toBeNull();
  });

  it.each([
    [UserRole.CUSTOMER, 'other-client'],
    [UserRole.SPECIALIST, 'other-specialist'],
    [undefined, undefined],
  ])('rejects unrelated or anonymous detail requests (%s)', async (role, id) => {
    await expect(serviceFor().getById('process-1', id, role)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects another customer and anonymous list requests', async () => {
    await expect(list(serviceFor(), 'other-client')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(serviceFor().getByClientId('client-1', {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns missing fields explicitly without substituting listing contacts', async () => {
    const record = fixture();
    record.specialist.email = null;
    record.specialist.phone = '   ';
    const result = await list(serviceFor(record));
    expect(result.specialist).toMatchObject({ id: 'process-specialist', name: 'Ana', surname: 'Silva', email: null, phone: null });
    expect(JSON.stringify(result)).not.toContain('wrong@example.test');
  });
});
