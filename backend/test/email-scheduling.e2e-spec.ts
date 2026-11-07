import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  cleanupEmailSchedulingFixtures,
  emailSchedulingFixtures,
  readEmailSchedulingE2EConfig,
  seedEmailSchedulingFixtures,
} from '../prisma/seed-email-scheduling-e2e';
import {
  getSanitizeCallCount,
  resetSanitizeCallCount,
} from './mocks/isomorphic-dompurify';

const fixture = emailSchedulingFixtures('http');
const proposedIso = '2099-10-20T17:30:00.000Z';
const changedIso = '2099-10-21T19:00:00.000Z';
const secondIso = '2099-10-23T17:30:00.000Z';
const checkKeys = [
  'exists',
  'appointment_id',
  'process_id',
  'appointment_status',
  'scheduling_method',
  'appointment_datetime',
  'specialist_contact_email',
  'process',
];

// A dedicated URL opts in to the real PostgreSQL gate. Ordinary e2e discovery
// never falls back to a developer's DATABASE_URL or the application's .env.
const describeHttp = process.env.EMAIL_SCHEDULING_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describe('email scheduling fixture safety', () => {
  const validEnv = {
    EMAIL_SCHEDULING_E2E_DATABASE_URL:
      'postgresql://test:test@127.0.0.1:5432/email_scheduling_e2e',
    EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL: 'customer@example.test',
    EMAIL_SCHEDULING_E2E_CUSTOMER_PASSWORD: 'customer-test-password',
    EMAIL_SCHEDULING_E2E_SPECIALIST_EMAIL: 'specialist@example.test',
    EMAIL_SCHEDULING_E2E_SPECIALIST_PASSWORD: 'specialist-test-password',
    EMAIL_SCHEDULING_E2E_OUTSIDER_EMAIL: 'outsider@example.test',
    EMAIL_SCHEDULING_E2E_OUTSIDER_PASSWORD: 'outsider-test-password',
  };

  it('uses separate deterministic base IDs for browser seed and HTTP fixtures', () => {
    const browser = emailSchedulingFixtures('browser');
    const baseIds = (items: typeof fixture) => [
      ...items.users.map(({ id }) => id),
      ...items.cars.map(({ id }) => id),
    ];
    expect(new Set([...baseIds(browser), ...baseIds(fixture)]).size).toBe(10);
    expect(emailSchedulingFixtures('http')).toEqual(fixture);
  });

  it.each([
    undefined,
    'not-a-url',
    'postgresql://test:test@production.example.test:5432/database',
    'mysql://test:test@localhost:3306/database',
    'postgresql://test:test@localhost:5432/bmfluxdb',
  ])('rejects a missing, malformed or nonlocal database URL', (databaseUrl) => {
    expect(() =>
      readEmailSchedulingE2EConfig({
        ...validEnv,
        EMAIL_SCHEDULING_E2E_DATABASE_URL: databaseUrl,
      }),
    ).toThrow(/EMAIL_SCHEDULING_E2E_DATABASE_URL/);
  });

  it('requires environment credentials and only reserved .test recipients', () => {
    expect(() =>
      readEmailSchedulingE2EConfig({
        ...validEnv,
        EMAIL_SCHEDULING_E2E_CUSTOMER_PASSWORD: undefined,
      }),
    ).toThrow(/EMAIL_SCHEDULING_E2E_CUSTOMER_PASSWORD/);
    expect(() =>
      readEmailSchedulingE2EConfig({
        ...validEnv,
        EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL: 'customer@example.com',
      }),
    ).toThrow(/EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL/);
    expect(() =>
      readEmailSchedulingE2EConfig({
        ...validEnv,
        EMAIL_SCHEDULING_E2E_OUTSIDER_EMAIL:
          validEnv.EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL,
      }),
    ).toThrow(/distinct/i);
  });

  it('normalizes addresses and derives a separate HTTP login namespace', () => {
    const config = readEmailSchedulingE2EConfig(
      {
        ...validEnv,
        EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL: ' CUSTOMER@EXAMPLE.TEST ',
      },
      'http',
    );
    expect(config.credentials.customer.email).toBe(
      'customer+http@example.test',
    );
    expect(config.namespace).toBe('http');
  });

  it.each(['browser', 'http'] as const)(
    'rejects collisions across both email namespaces before seeding %s',
    (namespace) => {
      expect(() =>
        readEmailSchedulingE2EConfig(
          {
            ...validEnv,
            EMAIL_SCHEDULING_E2E_SPECIALIST_EMAIL:
              ' CUSTOMER+HTTP@EXAMPLE.TEST ',
          },
          namespace,
        ),
      ).toThrow(/distinct/i);
    },
  );

  it('keeps all six normalized browser and HTTP addresses distinct', () => {
    const emails = (['browser', 'http'] as const).flatMap((namespace) =>
      Object.values(
        readEmailSchedulingE2EConfig(validEnv, namespace).credentials,
      ).map(({ email }) => email),
    );
    expect(new Set(emails).size).toBe(6);
  });

  it('fails closed if the out-of-scope SVG sanitizer boundary is called', () => {
    const boundary =
      require('isomorphic-dompurify') as typeof import('./mocks/isomorphic-dompurify');
    boundary.resetSanitizeCallCount();
    try {
      expect(() => boundary.default.sanitize('<svg/>')).toThrow(
        /SVG sanitization is outside the email scheduling E2E gate/,
      );
      expect(boundary.getSanitizeCallCount()).toBe(1);
    } finally {
      boundary.resetSanitizeCallCount();
    }
  });
});

describeHttp('no-Calendly email scheduling (HTTP + PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaClient | undefined;
  let config: ReturnType<typeof readEmailSchedulingE2EConfig>;
  let fixtureReady = false;
  let customerToken: string;
  let specialistToken: string;
  let outsiderToken: string;
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldNotificationsEnabled = process.env.NOTIFICATIONS_ENABLED;

  beforeAll(async () => {
    config = readEmailSchedulingE2EConfig(process.env, 'http');
    for (const name of [
      'JWT_SECRET_ACCESS',
      'JWT_SECRET_REFRESH',
      'JWT_SECRET_REFERRAL',
      'JWT_SECRET_ADVISOR',
    ]) {
      if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
    }
    process.env.DATABASE_URL = config.databaseUrl;
    process.env.NOTIFICATIONS_ENABLED = 'false';
    resetSanitizeCallCount();
    // Resolve the complete application graph before connecting or seeding.
    // External delivery and unrelated background jobs are outside this gate.
    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');
    expect(getSanitizeCallCount()).toBe(0);
    const { PrismaClient } =
      require('@prisma/client') as typeof import('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: config.databaseUrl } },
    });
    await prisma.$connect();
    await seedEmailSchedulingFixtures(prisma, config, fixture);
    fixtureReady = true;
    await seedEmailSchedulingFixtures(prisma, config, fixture);
    expect(
      await prisma.user.count({
        where: { id: { in: fixture.users.map(({ id }) => id) } },
      }),
    ).toBe(3);
    expect(
      await prisma.car.count({
        where: { id: { in: fixture.cars.map(({ id }) => id) } },
      }),
    ).toBe(2);

    const { Test } =
      require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { ClassSerializerInterceptor, ValidationPipe } =
      require('@nestjs/common') as typeof import('@nestjs/common');
    const { Reflector } =
      require('@nestjs/core') as typeof import('@nestjs/core');
    const { PrismaService } =
      require('../src/prisma/prisma.service') as typeof import('../src/prisma/prisma.service');
    const { S3Service } =
      require('../src/aws/s3.service') as typeof import('../src/aws/s3.service');
    const { SesService } =
      require('../src/aws/ses.service') as typeof import('../src/aws/ses.service');
    const { DocuSignClient } =
      require('../src/providers/docusign/docusign.client') as typeof import('../src/providers/docusign/docusign.client');
    const { NotificationService } =
      require('../src/features/notifications/notification.service') as typeof import('../src/features/notifications/notification.service');
    const { RateLimitGuard } =
      require('../src/shared/guards/rate-limit.guard') as typeof import('../src/shared/guards/rate-limit.guard');
    const { ProductImportJobsService } =
      require('../src/features/product-import-jobs/product-import-jobs.service') as typeof import('../src/features/product-import-jobs/product-import-jobs.service');
    const { ConsultantInviteJobsService } =
      require('../src/features/office/consultant-invite-jobs.service') as typeof import('../src/features/office/consultant-invite-jobs.service');
    const { ClientInviteJobsService } =
      require('../src/features/consultant/client-invite-jobs.service') as typeof import('../src/features/consultant/client-invite-jobs.service');
    const { MeetingReminderService } =
      require('../src/features/meetings/meeting-reminder.service') as typeof import('../src/features/meetings/meeting-reminder.service');
    const { localizedValidationExceptionFactory } =
      require('../src/shared/validation/localized-validation-exception') as typeof import('../src/shared/validation/localized-validation-exception');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(S3Service)
      .useValue({})
      .overrideProvider(SesService)
      .useValue({})
      .overrideProvider(DocuSignClient)
      .useValue({})
      .overrideProvider(NotificationService)
      .useValue({ sendAppointmentConfirmedEmail: async () => undefined })
      .overrideProvider(ProductImportJobsService)
      .useValue({})
      .overrideProvider(ConsultantInviteJobsService)
      .useValue({})
      .overrideProvider(ClientInviteJobsService)
      .useValue({})
      .overrideProvider(MeetingReminderService)
      .useValue({})
      // RateLimitGuard owns an interval with no destruction hook. Its login
      // throttling is outside this gate; authentication itself is never stubbed.
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: localizedValidationExceptionFactory,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    app.useLogger(false);
    await app.init();
    expect(getSanitizeCallCount()).toBe(0);

    [customerToken, specialistToken, outsiderToken] = await Promise.all([
      login('customer'),
      login('specialist'),
      login('outsider'),
    ]);
  }, 30_000);

  afterAll(async () => {
    try {
      await app?.close();
      if (prisma && fixtureReady) {
        await cleanupEmailSchedulingFixtures(prisma, fixture);
        expect(
          await prisma.appointment.count({
            where: { client_id: fixture.users[0].id },
          }),
        ).toBe(0);
        expect(
          await prisma.process.count({
            where: { client_id: fixture.users[0].id },
          }),
        ).toBe(0);
      }
    } finally {
      await prisma?.$disconnect();
      if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldDatabaseUrl;
      if (oldNotificationsEnabled === undefined)
        delete process.env.NOTIFICATIONS_ENABLED;
      else process.env.NOTIFICATIONS_ENABLED = oldNotificationsEnabled;
    }
    expect(getSanitizeCallCount()).toBe(0);
  });

  async function login(actor: 'customer' | 'specialist' | 'outsider') {
    const response = await request(app!.getHttpServer())
      .post('/api/auth/login')
      .send(config.credentials[actor])
      .expect(201);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.access_token).toBe('string');
    expect(response.body.data.access_token.length > 0).toBe(true);
    expect(response.body.data.user.id).toBe(
      fixture.users.find((user) => user.actor === actor)!.id,
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        response.body.data.user,
        'password_hash',
      ),
    ).toBe(false);
    const cookies = response.headers['set-cookie'] as unknown as
      | string[]
      | undefined;
    expect(
      Array.isArray(cookies) &&
        cookies.some((cookie) => cookie.startsWith('refreshToken=')),
    ).toBe(true);
    return response.body.data.access_token as string;
  }

  function checkQuery(productId: string) {
    return {
      specialist_id: fixture.users[1].id,
      product_type: 'CAR',
      product_id: productId,
    };
  }

  function pendingBody(productId: string, datetime = proposedIso) {
    return {
      client_id: fixture.users[0].id,
      ...checkQuery(productId),
      scheduling_method: 'EMAIL',
      appointment_datetime: datetime,
    };
  }

  function assertNoPrivateFields(value: unknown) {
    const forbidden = new Set([
      'cpf',
      'rg',
      'password_hash',
      'civil_state',
      'bank',
      'agency',
      'checking_account',
      'calendly_connection',
      'calendly_user_uri',
      'calendly_organization_uri',
      'access_token',
      'refresh_token',
    ]);
    const visit = (item: unknown) => {
      if (!item || typeof item !== 'object') return;
      for (const [key, child] of Object.entries(item)) {
        expect(forbidden.has(key)).toBe(false);
        visit(child);
      }
    };
    visit(value);
  }

  function assertNoContacts(value: unknown) {
    assertNoPrivateFields(value);
    const serialized = JSON.stringify(value);
    for (const actor of ['customer', 'specialist', 'outsider'] as const) {
      expect(serialized.includes(config.credentials[actor].email)).toBe(false);
    }
    for (const user of fixture.users) {
      expect(serialized.includes(user.phone)).toBe(false);
    }
  }

  function assertOwnerScopedSpecialistEmail(value: unknown) {
    assertNoPrivateFields(value);
    const serialized = JSON.stringify(value);
    expect(serialized.includes(config.credentials.specialist.email)).toBe(true);
    expect(serialized.includes(config.credentials.outsider.email)).toBe(false);
    for (const user of fixture.users) {
      expect(serialized.includes(user.phone)).toBe(false);
    }
  }

  async function assertStoredState(
    productId: string,
    processId: string,
    appointmentId: string,
    status: 'PENDING' | 'SCHEDULED',
    datetime: string,
  ) {
    const appointments = await prisma!.appointment.findMany({
      where: {
        client_id: fixture.users[0].id,
        specialist_id: fixture.users[1].id,
        product_id: productId,
      },
    });
    const processes = await prisma!.process.findMany({
      where: {
        client_id: fixture.users[0].id,
        specialist_id: fixture.users[1].id,
        car_id: productId,
      },
      include: { ProcessStatusHistory: { orderBy: { id: 'asc' } } },
    });
    expect(appointments).toHaveLength(1);
    expect(processes).toHaveLength(1);
    expect(appointments[0]).toMatchObject({
      id: appointmentId,
      status,
      scheduling_method: 'EMAIL',
      appointment_datetime: new Date(datetime),
      specialist_rescheduled_at: null,
      specialist_rescheduled_from: null,
      confirmed_by_id: status === 'SCHEDULED' ? fixture.users[1].id : null,
    });
    expect(appointments[0].confirmed_at === null).toBe(status === 'PENDING');
    expect(processes[0]).toMatchObject({
      id: processId,
      appointment_id: appointmentId,
      status: 'SCHEDULING',
    });
    expect(processes[0].ProcessStatusHistory).toHaveLength(1);
    expect(processes[0].ProcessStatusHistory[0].status).toBe('SCHEDULING');
    return { appointment: appointments[0], process: processes[0] };
  }

  it('serves only the public business profile and blocks private profile IDOR', async () => {
    const profile = await request(app!.getHttpServer())
      .get(`/api/specialists/${fixture.users[1].id}/public-profile`)
      .expect(200);
    expect(Object.keys(profile.body).sort()).toEqual(
      [
        'id',
        'name',
        'surname',
        'speciality',
        'calendly_url',
        'calendly_scheduling_available',
      ].sort(),
    );
    expect(profile.body).toMatchObject({
      id: fixture.users[1].id,
      calendly_url: null,
      calendly_scheduling_available: false,
    });
    expect(profile.body).not.toHaveProperty('email');
    assertNoPrivateFields(profile.body);
    expect(profile.body).not.toHaveProperty('phone');
    await request(app!.getHttpServer())
      .get(`/api/users/${fixture.users[0].id}`)
      .expect(401);
    const unchangedProfile = {
      id: true,
      name: true,
      surname: true,
      phone: true,
      calendly_url: true,
      updated_at: true,
    } as const;
    const before = await prisma!.user.findUniqueOrThrow({
      where: { id: fixture.users[0].id },
      select: unchangedProfile,
    });
    for (const token of [specialistToken, outsiderToken]) {
      const deniedGet = await request(app!.getHttpServer())
        .get(`/api/users/${fixture.users[0].id}`)
        .auth(token, { type: 'bearer' })
        .expect(403);
      assertNoContacts(deniedGet.body);
      const deniedPatch = await request(app!.getHttpServer())
        .patch(`/api/users/${fixture.users[0].id}`)
        .auth(token, { type: 'bearer' })
        .send({ name: 'IDOR should never be written' })
        .expect(403);
      assertNoContacts(deniedPatch.body);
    }
    expect(
      await prisma!.user.findUniqueOrThrow({
        where: { id: before.id },
        select: unchangedProfile,
      }),
    ).toEqual(before);
    await request(app!.getHttpServer())
      .get(`/api/users/${fixture.users[0].id}`)
      .auth(customerToken, { type: 'bearer' })
      .expect(200);
  });

  it('derives own-check identity from JWT and rejects query identity/other roles', async () => {
    const own = await request(app!.getHttpServer())
      .get('/api/appointments/check')
      .auth(customerToken, { type: 'bearer' })
      .query(checkQuery(fixture.cars[0].id))
      .expect(200);
    expect(own.body.data).toEqual({ exists: false, process: null });
    assertNoContacts(own.body);
    await request(app!.getHttpServer())
      .get('/api/appointments/check')
      .query(checkQuery(fixture.cars[0].id))
      .expect(401);
    await request(app!.getHttpServer())
      .get('/api/appointments/check')
      .auth(customerToken, { type: 'bearer' })
      .query({
        ...checkQuery(fixture.cars[0].id),
        client_id: fixture.users[2].id,
      })
      .expect(400);
    for (const token of [specialistToken, outsiderToken]) {
      const denied = await request(app!.getHttpServer())
        .get('/api/appointments/check')
        .auth(token, { type: 'bearer' })
        .query(checkQuery(fixture.cars[0].id))
        .expect(403);
      assertNoContacts(denied.body);
    }
  });

  it('does not expose specialist contact through an unavailable CALENDLY path', async () => {
    const { appointment_datetime: _date, ...withoutDate } = pendingBody(
      fixture.cars[0].id,
    );
    const calendly = await request(app!.getHttpServer())
      .post('/api/appointments/pending')
      .auth(customerToken, { type: 'bearer' })
      .send({ ...withoutDate, scheduling_method: 'CALENDLY' })
      .expect(409);

    expect(calendly.body.error.code).toBe('CALENDLY_UNAVAILABLE');
    expect(JSON.stringify(calendly.body)).not.toContain(
      'specialist_contact_email',
    );
    assertNoContacts(calendly.body);
  });

  it('rejects invalid creation, identity substitution and PLATFORM bypass without writes', async () => {
    const body = pendingBody(fixture.cars[0].id);
    const { appointment_datetime: _date, ...withoutDate } = body;
    for (const invalid of [
      withoutDate,
      { ...body, appointment_datetime: '2000-01-01T00:00:00.000Z' },
      { ...body, appointment_datetime: '2099-10-20T17:30' },
    ]) {
      await request(app!.getHttpServer())
        .post('/api/appointments/pending')
        .auth(customerToken, { type: 'bearer' })
        .send(invalid)
        .expect(400);
    }
    for (const [token, requestBody] of [
      [customerToken, { ...body, client_id: fixture.users[2].id }],
      [outsiderToken, body],
    ] as const) {
      const denied = await request(app!.getHttpServer())
        .post('/api/appointments/pending')
        .auth(token, { type: 'bearer' })
        .send(requestBody)
        .expect(403);
      assertNoContacts(denied.body);
    }
    const { scheduling_method: _method, ...directBody } = body;
    await request(app!.getHttpServer())
      .post('/api/appointments')
      .auth(customerToken, { type: 'bearer' })
      .send(directBody)
      .expect(403);
    expect(
      await prisma!.appointment.count({
        where: { client_id: fixture.users[0].id },
      }),
    ).toBe(0);
    expect(
      await prisma!.process.count({
        where: { client_id: fixture.users[0].id },
      }),
    ).toBe(0);
  });

  it('creates two dated proposals, projects assigned contacts, and confirms changed/unchanged times', async () => {
    const created = [] as {
      appointmentId: string;
      processId: string;
      productId: string;
    }[];
    for (const car of fixture.cars) {
      const response = await request(app!.getHttpServer())
        .post('/api/appointments/pending')
        .auth(customerToken, { type: 'bearer' })
        .send(pendingBody(car.id))
        .expect(201);
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        process_id: expect.any(String),
        status: 'PENDING',
        scheduling_method: 'EMAIL',
        appointment_datetime: proposedIso,
        client: { id: fixture.users[0].id },
        specialist: { id: fixture.users[1].id },
        product: { id: car.id },
        specialist_contact_email: config.credentials.specialist.email,
      });
      assertOwnerScopedSpecialistEmail(response.body);
      created.push({
        appointmentId: response.body.data.id,
        processId: response.body.data.process_id,
        productId: car.id,
      });
      await assertStoredState(
        car.id,
        response.body.data.process_id,
        response.body.data.id,
        'PENDING',
        proposedIso,
      );
      const own = await request(app!.getHttpServer())
        .get('/api/appointments/check')
        .auth(customerToken, { type: 'bearer' })
        .query(checkQuery(car.id))
        .expect(200);
      expect(Object.keys(own.body.data).sort()).toEqual([...checkKeys].sort());
      expect(own.body.data).toEqual({
        exists: true,
        appointment_id: response.body.data.id,
        process_id: response.body.data.process_id,
        appointment_status: 'PENDING',
        scheduling_method: 'EMAIL',
        appointment_datetime: proposedIso,
        specialist_contact_email: config.credentials.specialist.email,
        process: {
          id: response.body.data.process_id,
          status: 'SCHEDULING',
          is_active: true,
          status_history: [
            { status: 'SCHEDULING', changed_at: expect.any(String) },
          ],
        },
      });
      assertOwnerScopedSpecialistEmail(own.body);
      const duplicate = await request(app!.getHttpServer())
        .post('/api/appointments/pending')
        .auth(customerToken, { type: 'bearer' })
        .send(pendingBody(car.id))
        .expect(409);
      expect(duplicate.body.error.code).toBe('ACTIVE_PROCESS_EXISTS');
      const { exists: _exists, process: _process, ...snapshot } =
        own.body.data;
      expect(duplicate.body.error.details).toEqual({
        existing_request: snapshot,
      });
      assertOwnerScopedSpecialistEmail(duplicate.body);
      await assertStoredState(
        car.id,
        response.body.data.process_id,
        response.body.data.id,
        'PENDING',
        proposedIso,
      );
    }

    for (const { processId } of created) {
      const detail = await request(app!.getHttpServer())
        .get(`/api/processes/${processId}`)
        .auth(specialistToken, { type: 'bearer' })
        .expect(200);
      expect(detail.body.data.client).toEqual({
        id: fixture.users[0].id,
        name: fixture.users[0].name,
        email: config.credentials.customer.email,
        phone: fixture.users[0].phone,
      });
      assertNoPrivateFields(detail.body);
      const customer = await request(app!.getHttpServer())
        .get(`/api/processes/${processId}`)
        .auth(customerToken, { type: 'bearer' })
        .expect(200);
      expect(customer.body.data.client).not.toHaveProperty('email');
      expect(customer.body.data.client.phone).toBeNull();
      expect(customer.body.data.specialist.phone).toBeNull();
      assertNoContacts(customer.body);
      const outsider = await request(app!.getHttpServer())
        .get(`/api/processes/${processId}`)
        .auth(outsiderToken, { type: 'bearer' })
        .expect(403);
      assertNoContacts(outsider.body);
      for (const token of [customerToken, outsiderToken]) {
        await request(app!.getHttpServer())
          .post(`/api/processes/${processId}/confirm-appointment`)
          .auth(token, { type: 'bearer' })
          .send({ appointment_datetime: changedIso })
          .expect(403);
      }
    }
    const privateAppointment = await request(app!.getHttpServer())
      .get(`/api/appointments/${created[0].appointmentId}`)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(403);
    assertNoContacts(privateAppointment.body);
    const assignedList = await request(app!.getHttpServer())
      .get(`/api/processes/specialist/${fixture.users[1].id}`)
      .auth(specialistToken, { type: 'bearer' })
      .expect(200);
    expect(assignedList.body.data).toHaveLength(2);
    for (const process of assignedList.body.data) {
      expect(process.client.email).toBe(config.credentials.customer.email);
      expect(process.client.phone).toBe(fixture.users[0].phone);
    }
    const forbiddenList = await request(app!.getHttpServer())
      .get(`/api/processes/specialist/${fixture.users[1].id}`)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(403);
    assertNoContacts(forbiddenList.body);
    const emptyList = await request(app!.getHttpServer())
      .get(`/api/processes/specialist/${fixture.users[2].id}`)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(200);
    expect(emptyList.body.data).toEqual([]);
    assertNoContacts(emptyList.body);

    const confirm = (processId: string, datetime: string) =>
      request(app!.getHttpServer())
        .post(`/api/processes/${processId}/confirm-appointment`)
        .auth(specialistToken, { type: 'bearer' })
        .send({ appointment_datetime: datetime });
    const first = await confirm(created[0].processId, changedIso).expect(201);
    expect(first.body.data).toEqual({
      processId: created[0].processId,
      status: 'SCHEDULING',
      appointment_status: 'SCHEDULED',
      appointment_datetime: changedIso,
    });
    assertNoContacts(first.body);
    const firstStored = await assertStoredState(
      created[0].productId,
      created[0].processId,
      created[0].appointmentId,
      'SCHEDULED',
      changedIso,
    );
    expect(firstStored.process.notes).toContain(`proposta: ${proposedIso}`);
    expect(firstStored.process.notes).toContain(
      `horário confirmado: ${changedIso}`,
    );

    // A confirmed commitment conflicts; a still-pending EMAIL proposal did not.
    const conflict = await confirm(created[1].processId, changedIso).expect(
      409,
    );
    assertNoContacts(conflict.body);
    expect(Object.keys(conflict.body.error.details)).toEqual([
      'suggested_times',
    ]);
    for (const item of created) {
      expect(JSON.stringify(conflict.body).includes(item.appointmentId)).toBe(
        false,
      );
      expect(JSON.stringify(conflict.body).includes(item.processId)).toBe(
        false,
      );
    }
    await assertStoredState(
      created[1].productId,
      created[1].processId,
      created[1].appointmentId,
      'PENDING',
      proposedIso,
    );

    // The second product confirms its original suggestion without changing it.
    const second = await confirm(created[1].processId, proposedIso).expect(201);
    expect(second.body.data.appointment_datetime).toBe(proposedIso);
    await assertStoredState(
      created[1].productId,
      created[1].processId,
      created[1].appointmentId,
      'SCHEDULED',
      proposedIso,
    );
    const beforeRepeat = await assertStoredState(
      created[0].productId,
      created[0].processId,
      created[0].appointmentId,
      'SCHEDULED',
      changedIso,
    );
    await confirm(created[0].processId, changedIso).expect(201);
    const afterRepeat = await assertStoredState(
      created[0].productId,
      created[0].processId,
      created[0].appointmentId,
      'SCHEDULED',
      changedIso,
    );
    // Equality covers appointment confirmation/audit timestamps, process notes
    // and the full ordered history; assertStoredState also checks cardinality.
    expect(afterRepeat).toEqual(beforeRepeat);
    await confirm(created[0].processId, secondIso).expect(400);

    for (const item of created) {
      const confirmed = await request(app!.getHttpServer())
        .get(`/api/processes/${item.processId}`)
        .auth(specialistToken, { type: 'bearer' })
        .expect(200);
      expect(confirmed.body.data.status).toBe('SCHEDULING');
      expect(confirmed.body.data.appointment_status).toBe('SCHEDULED');
      expect(confirmed.body.data.client.email).toBe(
        config.credentials.customer.email,
      );
      expect(confirmed.body.data.client.phone).toBe(fixture.users[0].phone);
      const own = await request(app!.getHttpServer())
        .get('/api/appointments/check')
        .auth(customerToken, { type: 'bearer' })
        .query(checkQuery(item.productId))
        .expect(200);
      expect(Object.keys(own.body.data).sort()).toEqual([...checkKeys].sort());
      expect(own.body.data.appointment_status).toBe('SCHEDULED');
      expect(own.body.data.specialist_contact_email).toBe(
        config.credentials.specialist.email,
      );
      assertOwnerScopedSpecialistEmail(own.body);
    }
    expect(
      await prisma!.appointment.count({
        where: { client_id: fixture.users[0].id },
      }),
    ).toBe(2);
    expect(
      await prisma!.process.count({
        where: { client_id: fixture.users[0].id },
      }),
    ).toBe(2);
  }, 30_000);

  it('aborts cleanup before deleting anything when a fixture has a foreign participant', async () => {
    const sentinel = {
      id: '8c26e2a3-fd13-447a-9b6c-000000000901',
      client_id: fixture.users[0].id,
      specialist_id: fixture.users[2].id,
      product_id: fixture.cars[0].id,
      product_type: 'CAR' as const,
      scheduling_method: 'EMAIL' as const,
    };
    const before = {
      appointments: await prisma!.appointment.count({
        where: { client_id: fixture.users[0].id },
      }),
      processes: await prisma!.process.count({
        where: { client_id: fixture.users[0].id },
      }),
    };
    // Fixed test-owned ID; create fails on collision and never deletes a row
    // that existed before this test. The invalid participant is intentional.
    await prisma!.appointment.create({
      data: {
        ...sentinel,
        status: 'PENDING',
        appointment_datetime: new Date(secondIso),
      },
    });
    try {
      await expect(
        cleanupEmailSchedulingFixtures(prisma!, fixture),
      ).rejects.toThrow(/Refusing cleanup/);
      expect(
        await prisma!.appointment.count({
          where: { client_id: fixture.users[0].id },
        }),
      ).toBe(before.appointments + 1);
      expect(
        await prisma!.process.count({
          where: { client_id: fixture.users[0].id },
        }),
      ).toBe(before.processes);
      expect(await prisma!.appointment.count({ where: sentinel })).toBe(1);
    } finally {
      // Only the exact row created above may be removed; no cascade or broad
      // fixture reset is used to recover from the deliberate integrity failure.
      await prisma!.appointment.deleteMany({ where: sentinel });
    }
  });
});
