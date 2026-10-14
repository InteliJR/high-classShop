/**
 * Local-only fixtures for the no-Calendly scheduling gate. No .env fallback,
 * truncation, user deletion or product deletion. Generated workflow IDs are
 * resolved from an allowlist and validated before transactional cleanup.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type Actor = 'customer' | 'specialist' | 'outsider';
type Namespace = 'browser' | 'http';

export interface EmailSchedulingE2EConfig {
  databaseUrl: string;
  namespace: Namespace;
  credentials: Record<Actor, { email: string; password: string }>;
}

export function emailSchedulingFixtures(namespace: Namespace) {
  const prefix =
    namespace === 'browser'
      ? 'c848f474-6492-4ac1-8a7d'
      : '8c26e2a3-fd13-447a-9b6c';
  const rgPrefix = namespace === 'browser' ? '990801' : '990802';
  const users = [
    {
      actor: 'customer' as const,
      id: `${prefix}-000000000001`,
      name: 'E2E Cliente',
      surname: `Email ${namespace}`,
      rg: `${rgPrefix}00001`,
      phone: '11987654321',
      role: 'CUSTOMER' as const,
      speciality: null,
    },
    {
      actor: 'specialist' as const,
      id: `${prefix}-000000000002`,
      name: 'E2E Especialista',
      surname: `Email ${namespace}`,
      rg: `${rgPrefix}00002`,
      phone: '11976543210',
      role: 'SPECIALIST' as const,
      speciality: 'CAR' as const,
    },
    {
      actor: 'outsider' as const,
      id: `${prefix}-000000000003`,
      name: 'E2E Nao Atribuido',
      surname: `Email ${namespace}`,
      rg: `${rgPrefix}00003`,
      phone: '21998765432',
      role: 'SPECIALIST' as const,
      speciality: 'CAR' as const,
    },
  ];
  return {
    namespace,
    users,
    cars: [
      {
        id: `${prefix}-000000000101`,
        specialist_id: users[1].id,
        marca: 'E2E Email',
        modelo: 'Produto A',
        identificador: `email-scheduling-${namespace}-a`,
      },
      {
        id: `${prefix}-000000000102`,
        specialist_id: users[1].id,
        marca: 'E2E Email',
        modelo: 'Produto B',
        identificador: `email-scheduling-${namespace}-b`,
      },
    ],
  };
}

type Fixtures = ReturnType<typeof emailSchedulingFixtures>;

export function readEmailSchedulingE2EConfig(
  env: NodeJS.ProcessEnv,
  namespace: Namespace = 'browser',
): EmailSchedulingE2EConfig {
  const databaseUrl = env.EMAIL_SCHEDULING_E2E_DATABASE_URL?.trim();
  try {
    const url = new URL(databaseUrl ?? '');
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/(?:^|_)email_scheduling_e2e$/.test(url.pathname.slice(1))
    )
      throw new Error('invalid');
  } catch {
    throw new Error(
      'EMAIL_SCHEDULING_E2E_DATABASE_URL must name a dedicated *_email_scheduling_e2e PostgreSQL database on loopback',
    );
  }

  const credentials = {} as EmailSchedulingE2EConfig['credentials'];
  for (const actor of ['customer', 'specialist', 'outsider'] as const) {
    const emailKey = `EMAIL_SCHEDULING_E2E_${actor.toUpperCase()}_EMAIL`;
    const passwordKey = `EMAIL_SCHEDULING_E2E_${actor.toUpperCase()}_PASSWORD`;
    const email = env[emailKey]?.trim().toLowerCase();
    const password = env[passwordKey];
    if (!email || !/^[^\s@]+@[a-z0-9.-]+\.test$/.test(email)) {
      throw new Error(`${emailKey} must be a reserved .test email address`);
    }
    if (!password || password.length < 6 || !password.trim()) {
      throw new Error(`${passwordKey} must contain at least 6 characters`);
    }
    const [local, domain] = email.split('@');
    credentials[actor] = {
      email: namespace === 'http' ? `${local}+http@${domain}` : email,
      password,
    };
  }
  if (
    new Set(Object.values(credentials).map(({ email }) => email)).size !== 3
  ) {
    throw new Error('E2E emails must be distinct');
  }
  return { databaseUrl: databaseUrl!, namespace, credentials };
}

async function assertBaseOwnership(
  tx: Prisma.TransactionClient,
  fixture: Fixtures,
  config?: EmailSchedulingE2EConfig,
) {
  for (const expected of fixture.users) {
    const user = await tx.user.findUnique({
      where: { id: expected.id },
      select: {
        name: true,
        surname: true,
        rg: true,
        role: true,
        email: true,
        address_id: true,
        consultant_id: true,
        company_id: true,
        calendly_url: true,
        calendly_user_uri: true,
        calendly_organization_uri: true,
        calendly_connection: { select: { user_id: true } },
      },
    });
    if (!user) continue;
    if (
      user.name !== expected.name ||
      user.surname !== expected.surname ||
      user.rg !== expected.rg ||
      user.role !== expected.role ||
      (config && user.email !== config.credentials[expected.actor].email) ||
      user.address_id ||
      user.consultant_id ||
      user.company_id ||
      user.calendly_url ||
      user.calendly_user_uri ||
      user.calendly_organization_uri ||
      user.calendly_connection
    ) {
      throw new Error(
        'Refusing to reset a fixture user with unexpected ownership or relationships',
      );
    }
  }
  for (const expected of fixture.cars) {
    const car = await tx.car.findUnique({
      where: { id: expected.id },
      select: {
        identificador: true,
        specialist_id: true,
        marca: true,
        modelo: true,
      },
    });
    if (
      car &&
      (car.identificador !== expected.identificador ||
        car.specialist_id !== expected.specialist_id ||
        car.marca !== expected.marca ||
        car.modelo !== expected.modelo)
    ) {
      throw new Error(
        'Refusing to reset a fixture product with unexpected ownership',
      );
    }
  }
}

async function cleanupInTransaction(
  tx: Prisma.TransactionClient,
  fixture: Fixtures,
) {
  await assertBaseOwnership(tx, fixture);
  const userIds = fixture.users.map(({ id }) => id);
  const carIds = fixture.cars.map(({ id }) => id);
  const appointments = await tx.appointment.findMany({
    where: {
      OR: [
        { client_id: { in: userIds } },
        { specialist_id: { in: userIds } },
        { product_id: { in: carIds } },
      ],
    },
    include: { process: { select: { id: true } } },
  });
  const appointmentIds = appointments.map(({ id }) => id);
  const processes = await tx.process.findMany({
    where: {
      OR: [
        { client_id: { in: userIds } },
        { specialist_id: { in: userIds } },
        { car_id: { in: carIds } },
        { product_id: { in: carIds } },
        { appointment_id: { in: appointmentIds } },
      ],
    },
    include: {
      appointment: { select: { id: true } },
      ProcessStatusHistory: true,
      meeting_session: { select: { id: true } },
      _count: {
        select: {
          contracts: true,
          proposals: true,
          products: true,
          rejections: true,
        },
      },
    },
  });
  // All candidates are checked before the first delete. Unexpected cross-links
  // abort the whole reset, even when only one side matches a deterministic ID.
  for (const appointment of appointments) {
    const process = processes.find(({ id }) => id === appointment.process?.id);
    if (
      appointment.client_id !== fixture.users[0].id ||
      appointment.specialist_id !== fixture.users[1].id ||
      appointment.product_type !== 'CAR' ||
      !appointment.product_id ||
      !carIds.includes(appointment.product_id) ||
      appointment.scheduling_method !== 'EMAIL' ||
      !['PENDING', 'SCHEDULED'].includes(appointment.status) ||
      appointment.calendly_event_uri ||
      appointment.calendly_invitee_uri ||
      !process ||
      process.appointment_id !== appointment.id
    ) {
      throw new Error(
        'Refusing cleanup: unexpected appointment ownership, method or link',
      );
    }
  }
  for (const process of processes) {
    const appointment = appointments.find(
      ({ id }) => id === process.appointment_id,
    );
    if (
      process.client_id !== fixture.users[0].id ||
      process.specialist_id !== fixture.users[1].id ||
      process.product_type !== 'CAR' ||
      !process.car_id ||
      !carIds.includes(process.car_id) ||
      process.boat_id ||
      process.aircraft_id ||
      (process.product_id && process.product_id !== process.car_id) ||
      process.status !== 'SCHEDULING' ||
      !appointment ||
      appointment.product_id !== process.car_id ||
      process.meeting_session ||
      process.active_contract_id ||
      process.accepted_proposal_id ||
      Object.values(process._count).some((count) => count !== 0) ||
      process.ProcessStatusHistory.some(
        (history) =>
          history.status !== 'SCHEDULING' ||
          history.reason !== null ||
          (history.changed_by !== null &&
            !userIds.includes(history.changed_by)),
      )
    ) {
      throw new Error(
        'Refusing cleanup: unexpected process ownership or downstream data',
      );
    }
  }
  const processIds = processes.map(({ id }) => id);
  await tx.processStatusHistory.deleteMany({
    where: { processId: { in: processIds } },
  });
  await tx.process.deleteMany({ where: { id: { in: processIds } } });
  await tx.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await tx.refreshToken.deleteMany({ where: { user_id: { in: userIds } } });
}

export async function cleanupEmailSchedulingFixtures(
  prisma: PrismaClient,
  fixture: Fixtures,
) {
  await prisma.$transaction((tx) => cleanupInTransaction(tx, fixture), {
    isolationLevel: 'Serializable',
  });
}

export async function seedEmailSchedulingFixtures(
  prisma: PrismaClient,
  config: EmailSchedulingE2EConfig,
  fixture: Fixtures,
) {
  if (config.namespace !== fixture.namespace)
    throw new Error('Fixture namespace mismatch');
  const hashes: Record<Actor, string> = {
    customer: await bcrypt.hash(config.credentials.customer.password, 10),
    specialist: await bcrypt.hash(config.credentials.specialist.password, 10),
    outsider: await bcrypt.hash(config.credentials.outsider.password, 10),
  };
  await prisma.$transaction(
    async (tx) => {
      await assertBaseOwnership(tx, fixture, config);
      await cleanupInTransaction(tx, fixture);
      for (const user of fixture.users) {
        const { actor, ...fields } = user;
        const data = {
          ...fields,
          email: config.credentials[actor].email,
          password_hash: hashes[actor],
          is_active: true,
          deactivated_at: null,
          deactivated_by: null,
          calendly_url: null,
          calendly_user_uri: null,
          calendly_organization_uri: null,
        };
        await tx.user.upsert({
          where: { id: user.id },
          create: data,
          update: data,
        });
      }
      for (const [index, car] of fixture.cars.entries()) {
        const data = {
          ...car,
          is_active: true,
          deactivated_at: null,
          valor: 100000 + index * 10000,
          currency: 'BRL' as const,
          estado: 'SP',
          ano: 2026,
          descricao:
            'Produto sintético para o fluxo de reunião por e-mail E2E.',
        };
        await tx.car.upsert({
          where: { id: car.id },
          create: data,
          update: data,
        });
      }
    },
    { timeout: 15_000, isolationLevel: 'Serializable' },
  );
}

async function main() {
  // Validate before importing or constructing Prisma. Never echo the URL,
  // credential values, Prisma error metadata or fixture contacts to logs.
  const config = readEmailSchedulingE2EConfig(process.env);
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  });
  try {
    await seedEmailSchedulingFixtures(
      prisma,
      config,
      emailSchedulingFixtures('browser'),
    );
    console.log(
      'Email scheduling E2E fixtures ready: 3 users, 2 products (browser namespace).',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error(
      'Email scheduling E2E seed failed. Check local database, required test variables and fixture ownership; no credentials logged.',
    );
    process.exitCode = 1;
  });
}
