import { Prisma } from '@prisma/client';
import { AircraftsService } from '../aircrafts/aircrafts.service';
import { BoatsService } from '../boats/boats.service';
import { CarsService } from '../cars/cars.service';

const privateSpecialistFields = {
  cpf: '11222333000181',
  rg: '12345678901',
  phone: '+5511999999999',
  password_hash: 'private-password-hash',
  bank: 'private-bank',
  agency: '0001',
  checking_account: 'private-account',
  calendly_user_uri: 'https://api.calendly.com/users/private',
  calendly_organization_uri: 'https://api.calendly.com/organizations/private',
  calendly_connection: {
    access_token_encrypted: 'private-access-token',
    refresh_token_encrypted: 'private-refresh-token',
    webhook_uri: 'https://api.calendly.com/webhooks/private',
  },
};

const specialist = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Ana',
  surname: 'Silva',
  email: 'ana.private@example.test',
  ...privateSpecialistFields,
};

const images = [
  {
    id: 1,
    product_type: 'CAR',
    image_url: 'public-s3-key',
    is_primary: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    car_id: '11111111-1111-4111-8111-111111111111',
  },
];

const baseProduct = {
  id: '11111111-1111-4111-8111-111111111111',
  specialist_id: specialist.id,
  is_active: true,
  deactivated_at: null,
  deactivated_by_sync_job_id: '33333333-3333-4333-8333-333333333333',
  marca: 'Marca',
  modelo: 'Modelo',
  identificador: 'PUBLIC-1',
  valor: new Prisma.Decimal('100000.00'),
  currency: 'BRL',
  estado: 'SP',
  ano: 2026,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
  images,
  specialist,
};

function project(record: Record<string, any>, select: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(select).map(([key, selection]) => {
      const value = record[key];
      if (
        selection &&
        typeof selection === 'object' &&
        'select' in selection &&
        value != null
      ) {
        if (Array.isArray(value)) {
          return [key, value.map((item) => project(item, selection.select))];
        }
        return [key, project(value, selection.select)];
      }
      return [key, value];
    }),
  );
}

function makePrisma(model: 'car' | 'boat' | 'aircraft', record: object) {
  const findMany = jest.fn(async (args: any) =>
    args.select ? [project(record, args.select)] : [record],
  );
  const findUnique = jest.fn(async (args: any) =>
    args.select ? project(record, args.select) : record,
  );
  const delegate = {
    findMany,
    findUnique,
    count: jest.fn().mockResolvedValue(1),
  };
  return {
    prisma: {
      [model]: delegate,
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as any,
    findMany,
    findUnique,
  };
}

const forbiddenKeys = [
  'cpf',
  'cnpj',
  'rg',
  'phone',
  'telefone',
  'email',
  'password_hash',
  'bank',
  'agency',
  'checking_account',
  'calendly_user_uri',
  'calendly_organization_uri',
  'calendly_connection',
  'access_token_encrypted',
  'refresh_token_encrypted',
  'webhook_uri',
  'deactivated_at',
  'deactivated_by_sync_job_id',
];

function expectPublicPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const key of forbiddenKeys) {
    expect(serialized).not.toContain(`"${key}"`);
  }
  expect(serialized).not.toContain('private-');
}

describe.each([
  {
    label: 'cars',
    model: 'car' as const,
    record: { ...baseProduct, descricao: 'Descrição', images },
    makeService: (prisma: any, s3: any) => new CarsService(prisma, s3),
    list: (service: CarsService) =>
      service.getAllCars({ page: 1, perPage: 20, appliedFilters: {} }),
    detail: (service: CarsService) => service.findOne(baseProduct.id),
  },
  {
    label: 'boats',
    model: 'boat' as const,
    record: {
      ...baseProduct,
      descricao_completa: 'Descrição',
      images: images.map((image) => ({
        ...image,
        product_type: 'BOAT',
        car_id: undefined,
        boat_id: baseProduct.id,
      })),
    },
    makeService: (prisma: any, s3: any) => new BoatsService(prisma, s3),
    list: (service: BoatsService) =>
      service.getAllBoats({ page: 1, perPage: 20, appliedFilters: {} }),
    detail: (service: BoatsService) => service.findOne(baseProduct.id),
  },
  {
    label: 'aircrafts',
    model: 'aircraft' as const,
    record: {
      ...baseProduct,
      descricao: 'Descrição',
      images: images.map((image) => ({
        ...image,
        product_type: 'AIRCRAFT',
        car_id: undefined,
        aircraft_id: baseProduct.id,
      })),
    },
    makeService: (prisma: any, s3: any) => new AircraftsService(prisma, s3),
    list: (service: AircraftsService) =>
      service.getAllAircrafts({ page: 1, perPage: 20, appliedFilters: {} }),
    detail: (service: AircraftsService) => service.findOne(baseProduct.id),
  },
])('$label public catalog projection', (scenario) => {
  const s3 = {
    getSignedUrl: jest.fn(async (key: string) => `https://cdn.test/${key}`),
  };

  it('uses a default-deny projection and exposes only the public specialist identity in list responses', async () => {
    const { prisma, findMany } = makePrisma(scenario.model, scenario.record);
    const service = scenario.makeService(prisma, s3) as any;

    const result = await scenario.list(service);

    expect(findMany.mock.calls[0][0]).toHaveProperty('select');
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('include');
    expect(result.data[0].specialist).toEqual({
      id: specialist.id,
      name: specialist.name,
      surname: specialist.surname,
    });
    expectPublicPayload(result.data[0]);
  });

  it('uses a default-deny projection for the public detail response', async () => {
    const { prisma, findUnique } = makePrisma(scenario.model, scenario.record);
    const service = scenario.makeService(prisma, s3) as any;

    const result = await scenario.detail(service);

    expect(findUnique.mock.calls[0][0]).toHaveProperty('select');
    expect(findUnique.mock.calls[0][0]).not.toHaveProperty('include');
    expectPublicPayload(result);
  });
});
