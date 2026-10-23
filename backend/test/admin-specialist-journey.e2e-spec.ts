import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.ADMIN_SPECIALIST_E2E_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

const ids = {
  admin: 'a11d0000-0000-4000-8000-000000000001',
  specialistA: 'a11d0000-0000-4000-8000-000000000002',
  specialistB: 'a11d0000-0000-4000-8000-000000000003',
  customer: 'a11d0000-0000-4000-8000-000000000004',
};
const password = 'admin-specialist-e2e-password';
const credentials = {
  admin: { email: 'admin-journey@example.test', password },
  specialistA: { email: 'specialist-a-journey@example.test', password },
  specialistB: { email: 'specialist-b-journey@example.test', password },
  customer: { email: 'customer-journey@example.test', password },
};

describePostgres('ADMIN acting for SPECIALIST journey (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let specialistAToken: string;
  let customerToken: string;
  let productId: string;
  let processId: string;
  const envelopes = new Map<
    string,
    { processId: string; requestFingerprint: string; status: string }
  >();
  const previousEnv = new Map<string, string | undefined>();

  function target(id = ids.specialistA) {
    return { target_specialist_id: id };
  }

  async function cleanup() {
    if (!prisma) return;
    const userIds = Object.values(ids);
    const processes = await prisma.process.findMany({
      where: {
        OR: [
          { client_id: ids.customer },
          { specialist_id: { in: [ids.specialistA, ids.specialistB] } },
        ],
      },
      select: { id: true },
    });
    const processIds = processes.map(({ id }) => id);
    await prisma.process.updateMany({
      where: { id: { in: processIds } },
      data: { active_contract_id: null, accepted_proposal_id: null },
    });
    await prisma.contract.deleteMany({ where: { process_id: { in: processIds } } });
    await prisma.negotiationProposal.deleteMany({
      where: { process_id: { in: processIds } },
    });
    await prisma.meetingSession.deleteMany({
      where: { process_id: { in: processIds } },
    });
    await prisma.processStatusHistory.deleteMany({
      where: { processId: { in: processIds } },
    });
    await prisma.processRejection.deleteMany({
      where: { process_id: { in: processIds } },
    });
    await prisma.process.deleteMany({ where: { id: { in: processIds } } });
    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { client_id: ids.customer },
          { specialist_id: { in: [ids.specialistA, ids.specialistB] } },
        ],
      },
    });
    await prisma.car.deleteMany({
      where: { specialist_id: { in: [ids.specialistA, ids.specialistB] } },
    });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.$executeRaw`
      DELETE FROM "DelegatedActionAudit"
      WHERE "actor_id" IN (${ids.admin}::uuid, ${ids.specialistA}::uuid,
        ${ids.specialistB}::uuid, ${ids.customer}::uuid)
         OR "represented_specialist_id" IN
        (${ids.specialistA}::uuid, ${ids.specialistB}::uuid)
    `;
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
      parsed.pathname.slice(1) !== 'admin_specialist_test'
    ) {
      throw new Error(
        'ADMIN_SPECIALIST_E2E_DATABASE_URL must point to loopback/admin_specialist_test',
      );
    }
    for (const [key, value] of Object.entries({
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      NOTIFICATIONS_ENABLED: 'false',
      MEETING_PROVIDER: 'JITSI',
      JWT_SECRET_ACCESS: 'local-admin-journey-access-secret',
      JWT_SECRET_REFRESH: 'local-admin-journey-refresh-secret',
      JWT_SECRET_REFERRAL: 'local-admin-journey-referral-secret',
      JWT_SECRET_ADVISOR: 'local-admin-journey-advisor-secret',
    })) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = value;
    }

    const { PrismaClient } =
      require('@prisma/client') as typeof import('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    await prisma.$connect();
    await cleanup();
    const hash = await bcrypt.hash(password, 4);
    await prisma.user.createMany({
      data: [
        {
          id: ids.admin,
          name: 'Admin',
          surname: 'Journey',
          email: credentials.admin.email,
          password_hash: hash,
          rg: '99110000001',
          role: 'ADMIN',
          is_active: true,
        },
        {
          id: ids.specialistA,
          name: 'Specialist',
          surname: 'Alpha',
          email: credentials.specialistA.email,
          password_hash: hash,
          rg: '99110000002',
          role: 'SPECIALIST',
          speciality: 'CAR',
          commission_rate: 70,
          is_active: true,
        },
        {
          id: ids.specialistB,
          name: 'Specialist',
          surname: 'Beta',
          email: credentials.specialistB.email,
          password_hash: hash,
          rg: '99110000003',
          role: 'SPECIALIST',
          speciality: 'CAR',
          commission_rate: 60,
          is_active: true,
        },
        {
          id: ids.customer,
          name: 'Customer',
          surname: 'Journey',
          email: credentials.customer.email,
          password_hash: hash,
          rg: '99110000004',
          role: 'CUSTOMER',
          is_active: true,
        },
      ],
    });

    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');
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
    const { NotificationService } =
      require('../src/features/notifications/notification.service') as typeof import('../src/features/notifications/notification.service');
    const { ProductImportJobsService } =
      require('../src/features/product-import-jobs/product-import-jobs.service') as typeof import('../src/features/product-import-jobs/product-import-jobs.service');
    const { ConsultantInviteJobsService } =
      require('../src/features/office/consultant-invite-jobs.service') as typeof import('../src/features/office/consultant-invite-jobs.service');
    const { ClientInviteJobsService } =
      require('../src/features/consultant/client-invite-jobs.service') as typeof import('../src/features/consultant/client-invite-jobs.service');
    const { MeetingReminderService } =
      require('../src/features/meetings/meeting-reminder.service') as typeof import('../src/features/meetings/meeting-reminder.service');
    const { DocuSignService } =
      require('../src/providers/docusign/docusign.service') as typeof import('../src/providers/docusign/docusign.service');
    const { DocuSignClient } =
      require('../src/providers/docusign/docusign.client') as typeof import('../src/providers/docusign/docusign.client');
    const { PlatformCompanyService } =
      require('../src/features/platform-company/platform-company.service') as typeof import('../src/features/platform-company/platform-company.service');
    const { RateLimitGuard } =
      require('../src/shared/guards/rate-limit.guard') as typeof import('../src/shared/guards/rate-limit.guard');
    const { localizedValidationExceptionFactory } =
      require('../src/shared/validation/localized-validation-exception') as typeof import('../src/shared/validation/localized-validation-exception');

    const notifications = new Proxy(
      {},
      {
        get: (_target, property) =>
          property === 'then' ? undefined : async () => undefined,
      },
    );
    const docusign = {
      createEnvelopePreview: async (params: any) => {
        const envelopeId = randomUUID();
        envelopes.set(envelopeId, {
          processId: params.processId,
          requestFingerprint: params.requestFingerprint,
          status: 'created',
        });
        params.onEnvelopeCreated?.(envelopeId);
        return {
          envelopeId,
          previewUrl: `https://docusign.example.test/${envelopeId}`,
          expiresAt: '2099-01-01T00:00:00.000Z',
        };
      },
      getEnvelopeProcessId: async (id: string) => envelopes.get(id)?.processId,
      getEnvelopeRequestFingerprint: async (id: string) =>
        envelopes.get(id)?.requestFingerprint,
      getEnvelopeStatus: async (id: string) => ({
        envelopeId: id,
        status: envelopes.get(id)?.status ?? 'created',
      }),
      sendDraftEnvelope: async (id: string) => {
        const envelope = envelopes.get(id)!;
        envelope.status = 'sent';
        return { envelopeId: id, status: 'sent' };
      },
      voidDraftEnvelope: async (id: string) => {
        const envelope = envelopes.get(id);
        if (envelope) envelope.status = 'voided';
      },
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(S3Service)
      .useValue({ getSignedUrl: async (key: string) => key })
      .overrideProvider(SesService)
      .useValue({})
      .overrideProvider(NotificationService)
      .useValue(notifications)
      .overrideProvider(ProductImportJobsService)
      .useValue({})
      .overrideProvider(ConsultantInviteJobsService)
      .useValue({})
      .overrideProvider(ClientInviteJobsService)
      .useValue({})
      .overrideProvider(MeetingReminderService)
      .useValue({})
      .overrideProvider(DocuSignService)
      .useValue(docusign)
      .overrideProvider(DocuSignClient)
      .useValue({})
      .overrideProvider(PlatformCompanyService)
      .useValue({ findOne: async () => ({ default_commission_rate: 10 }) })
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

    const login = async (credential: { email: string; password: string }) => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credential)
        .expect(201);
      return response.body.data.access_token as string;
    };
    [adminToken, specialistAToken, customerToken] = await Promise.all([
      login(credentials.admin),
      login(credentials.specialistA),
      login(credentials.customer),
    ]);
  }, 60_000);

  afterAll(async () => {
    try {
      await app?.close();
      await cleanup();
    } finally {
      await prisma?.$disconnect();
      for (const [key, value] of previousEnv) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 30_000);

  it('keeps A as executor, S as owner and blocks a mismatched represented specialist', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/cars')
      .auth(adminToken, { type: 'bearer' })
      .send({
        specialist_id: ids.specialistA,
        marca: 'Admin Journey E2E',
        modelo: 'Owner Alpha',
        identificador: 'admin-journey-owner-alpha',
        valor: 100000,
        currency: 'BRL',
        estado: 'SP',
        ano: 2026,
      })
      .expect(201);
    productId = created.body.id;
    expect(created.body.specialist_id).toBe(ids.specialistA);
    const inactiveProduct = await prisma.car.create({
      data: {
        specialist_id: ids.specialistA,
        marca: 'Admin Journey E2E',
        modelo: 'Inactive visible to admin',
        identificador: 'admin-journey-inactive-alpha',
        valor: 80000,
        currency: 'BRL',
        estado: 'SP',
        ano: 2025,
        is_active: false,
      },
    });
    const adminCatalog = await request(app.getHttpServer())
      .get('/api/cars/admin/all')
      .query({ ...target(), page: 1, perPage: 20 })
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(adminCatalog.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productId, is_active: true }),
        expect.objectContaining({ id: inactiveProduct.id, is_active: false }),
      ]),
    );
    const otherCatalog = await request(app.getHttpServer())
      .get('/api/cars/admin/all')
      .query({ ...target(ids.specialistB), page: 1, perPage: 20 })
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(otherCatalog.body.data).toEqual([]);

    await request(app.getHttpServer())
      .patch(`/api/cars/${productId}`)
      .query(target(ids.specialistB))
      .auth(adminToken, { type: 'bearer' })
      .send({ modelo: 'Must not change' })
      .expect(403);
    const customerMutation = await request(app.getHttpServer())
      .patch(`/api/cars/${productId}`)
      .query(target())
      .auth(customerToken, { type: 'bearer' })
      .send({ modelo: 'Customer must not change' });
    expect([401, 403]).toContain(customerMutation.status);
    expect((await prisma.car.findUniqueOrThrow({ where: { id: productId } })).modelo)
      .toBe('Owner Alpha');

    const audits = await prisma.$queryRaw<
      Array<{ actor_id: string; represented_specialist_id: string }>
    >`SELECT "actor_id", "represented_specialist_id"
      FROM "DelegatedActionAudit" WHERE "resource_id" = ${productId}`;
    expect(audits).toEqual([
      {
        actor_id: ids.admin,
        represented_specialist_id: ids.specialistA,
      },
    ]);
  });

  it('runs process, appointment, concurrent meeting/proposal and simulated DocuSign end to end', async () => {
    const processResponse = await request(app.getHttpServer())
      .post('/api/processes')
      .auth(adminToken, { type: 'bearer' })
      .send({
        client_id: ids.customer,
        specialist_id: ids.specialistA,
        product_type: 'CAR',
        product_id: productId,
        notes: 'HTTP E2E admin journey',
      })
      .expect(201);
    processId = processResponse.body.data.id;
    const storedProcess = await prisma.process.findUniqueOrThrow({
      where: { id: processId },
      include: { appointment: true },
    });
    expect(storedProcess.specialist_id).toBe(ids.specialistA);
    expect(storedProcess.appointment).toMatchObject({
      status: 'PENDING',
      scheduling_method: 'EMAIL',
    });

    await request(app.getHttpServer())
      .get(`/api/processes/${processId}`)
      .query(target(ids.specialistB))
      .auth(adminToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/processes/${processId}/confirm-appointment`)
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .send({ appointment_datetime: '2099-10-23T17:30:00.000Z' })
      .expect(201);
    expect(
      (await prisma.appointment.findUniqueOrThrow({
        where: { id: storedProcess.appointment_id! },
      })).confirmed_by_id,
    ).toBe(ids.admin);

    await request(app.getHttpServer())
      .post(`/api/meetings/process/${processId}/start`)
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(
      (await prisma.meetingSession.findUniqueOrThrow({
        where: { process_id: processId },
      })).started_by_id,
    ).toBe(ids.admin);
    const endResults = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/api/meetings/process/${processId}/end`)
          .query(target())
          .auth(adminToken, { type: 'bearer' }),
      ),
    );
    expect(endResults.map(({ status }) => status)).toEqual([201, 201]);
    expect(
      endResults.map(({ body }) => body.data.alreadyEnded).sort(),
    ).toEqual([false, true]);

    const conversation = await request(app.getHttpServer())
      .post(`/api/meetings/process/${processId}/conversation-done`)
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    expect(conversation.body.data.processTransition.status).toBe('NEGOTIATION');

    const proposalResults = await Promise.all(
      [90000, 91000].map((value) =>
        request(app.getHttpServer())
          .post('/api/proposals')
          .query(target())
          .auth(adminToken, { type: 'bearer' })
          .send({ process_id: processId, proposed_value: value }),
      ),
    );
    expect(proposalResults.map(({ status }) => status).sort()).toEqual([
      201, 400,
    ]);
    await expect(
      prisma.negotiationProposal.count({
        where: { process_id: processId, status: 'PENDING' },
      }),
    ).resolves.toBe(1);
    const proposal = proposalResults.find(({ status }) => status === 201)!.body
      .data;
    expect(proposal.proposed_by.id).toBe(ids.specialistA);
    await request(app.getHttpServer())
      .patch(`/api/proposals/${proposal.id}/accept`)
      .auth(customerToken, { type: 'bearer' })
      .send({ message: 'Aceita no E2E' })
      .expect(200);

    const accepted = await prisma.negotiationProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    const contractDto = {
      operation_id: randomUUID(),
      return_url: 'http://localhost/admin/journey/contracts/preview-callback',
      process_id: processId,
      template_id: 'admin-journey-template',
      seller_name: 'Seller Distinct',
      seller_email: 'seller-distinct@example.test',
      buyer_name: 'Customer Journey',
      buyer_email: credentials.customer.email,
      specialist_name: 'Specialist Alpha',
      specialist_email: credentials.specialistA.email,
      vehicle_model: 'Owner Alpha',
      vehicle_year: '2026',
      vehicle_price: Number(accepted.proposed_value),
      payment_seller_value: Number(accepted.proposed_value) * 0.9,
      total_commission_rate: 10,
      city: 'Sao Paulo',
      description: 'Approved E2E legal content',
    };
    const preview = await request(app.getHttpServer())
      .post('/api/contracts/preview')
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .send(contractDto)
      .expect(201);
    const envelopeId = preview.body.data.envelope_id;
    await request(app.getHttpServer())
      .post(`/api/contracts/send/${envelopeId}`)
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .send(contractDto)
      .expect(201);

    const contract = await prisma.contract.findFirstOrThrow({
      where: { process_id: processId },
    });
    expect(contract).toMatchObject({
      uploaded_by_id: ids.admin,
      provider_id: envelopeId,
      status: 'PENDING',
    });
    expect(envelopes.get(envelopeId)?.status).toBe('sent');
    const auditRows = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT "action" FROM "DelegatedActionAudit"
      WHERE "actor_id" = ${ids.admin}::uuid
        AND "represented_specialist_id" = ${ids.specialistA}::uuid
        AND "resource_id" IN (${processId}, ${contract.id}, ${envelopeId})
      ORDER BY "created_at" ASC
    `;
    expect(auditRows.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'PROCESS_CREATE',
        'CONTRACT_PREVIEW',
        'CONTRACT_SEND',
      ]),
    );
    const timeline = await request(app.getHttpServer())
      .get(`/api/processes/${processId}/admin-timeline`)
      .query(target())
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(timeline.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'CONTRACT_SEND',
          actor: expect.objectContaining({ id: ids.admin, role: 'ADMIN' }),
          representedSpecialistId: ids.specialistA,
        }),
      ]),
    );
    await request(app.getHttpServer())
      .get(`/api/processes/${processId}/admin-timeline`)
      .query(target(ids.specialistB))
      .auth(adminToken, { type: 'bearer' })
      .expect(403);

    const specialistOwnList = await request(app.getHttpServer())
      .get(`/api/processes/specialist/${ids.specialistA}`)
      .auth(specialistAToken, { type: 'bearer' })
      .expect(200);
    expect(specialistOwnList.body.data.some(({ id }: any) => id === processId))
      .toBe(true);
  }, 30_000);
});
