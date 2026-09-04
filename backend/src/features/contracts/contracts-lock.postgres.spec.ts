import { PrismaClient, ProcessStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ContractsService } from './contracts.service';
import { ContractAlreadyExistsException } from '../../shared/exceptions/custom-exceptions';
import { InternalServerErrorException } from '@nestjs/common';
import { EnvelopeStatus } from '../../providers/docusign/enums/envelope-status.enum';

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function bindMember(target: any, property: PropertyKey): any {
  const value = Reflect.get(target, property);
  return typeof value === 'function' ? value.bind(target) : value;
}

function signalContractLockAttempt(client: PrismaClient, attempted: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === '$queryRaw') {
          return (strings: TemplateStringsArray, ...values: unknown[]) => {
            if (String(values[0]).startsWith('contract-process:')) {
              attempted.resolve();
            }
            return target.$queryRaw(strings, ...values);
          };
        }
        return bindMember(target, property);
      },
    });
  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction((tx) => callback(wrapTransaction(tx)), options);
      }
      return bindMember(target, property);
    },
  });
}

function failCommittedTransactionAck(
  client: PrismaClient,
  committed: Deferred,
  releaseAck: Deferred,
) {
  let failNext = true;
  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return async (
          callback: (tx: any) => Promise<unknown>,
          options?: any,
        ) => {
          const result = await target.$transaction(callback, options);
          if (failNext) {
            failNext = false;
            committed.resolve();
            await releaseAck.promise;
            throw new Error('lost commit acknowledgement: raw database text');
          }
          return result;
        };
      }
      return bindMember(target, property);
    },
  });
}

function withApplicationName(url: string, name: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}application_name=${encodeURIComponent(name)}&connection_limit=1&pool_timeout=3`;
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('contract process lock — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const clientId = randomUUID();
  const specialistId = randomUUID();
  const processId = randomUUID();
  const sendProcessId = randomUUID();
  const ambiguousCommitProcessId = randomUUID();
  const first = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, 'contract-lock-a') },
    },
  });
  const second = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, 'contract-lock-b') },
    },
  });
  const holder = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, 'contract-lock-holder') },
    },
  });

  beforeAll(async () => {
    await first.user.createMany({
      data: [
        {
          id: clientId,
          name: 'Contract',
          surname: 'Client',
          email: `contract-client-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Contract',
          surname: 'Specialist',
          email: `contract-specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          password_hash: 'not-used',
        },
      ],
    });
    await first.process.createMany({
      data: [processId, sendProcessId, ambiguousCommitProcessId].map((id) => ({
        id,
        client_id: clientId,
        specialist_id: specialistId,
        status: ProcessStatus.DOCUMENTATION,
        negotiation_currency: 'BRL' as const,
        negotiation_product_value: 100000,
      })),
    });
  });

  afterAll(async () => {
    await first.process.updateMany({
      where: { id: { in: [processId, sendProcessId, ambiguousCommitProcessId] } },
      data: { active_contract_id: null },
    });
    await first.contract.deleteMany({
      where: { process_id: { in: [processId, sendProcessId, ambiguousCommitProcessId] } },
    });
    await first.process.deleteMany({
      where: { id: { in: [processId, sendProcessId, ambiguousCommitProcessId] } },
    });
    await first.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([
      first.$disconnect(),
      second.$disconnect(),
      holder.$disconnect(),
    ]);
  });

  it('lets only one external generation win with one connection per pool and preserves status', async () => {
    let envelopeSequence = 0;
    const createEnvelopeFromTemplate = jest.fn(async (params: any) => {
      envelopeSequence += 1;
      const envelopeId = randomUUID();
      params.onEnvelopeCreated?.(envelopeId);
      return { envelopeId, status: 'sent' };
    });
    const docusign = { createEnvelopeFromTemplate } as any;
    const notifications = {
      sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const platformCompany = {
      findOne: jest.fn().mockResolvedValue({ default_commission_rate: 10 }),
    } as any;
    const firstAttempted = deferred();
    const secondAttempted = deferred();
    const holderReady = deferred();
    const releaseHolder = deferred();
    const lockKey = `contract-process:${processId}`;
    const held = holder.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      holderReady.resolve();
      await releaseHolder.promise;
    });
    await holderReady.promise;
    const serviceA = new ContractsService(
      signalContractLockAttempt(first, firstAttempted) as any,
      docusign,
      notifications,
      platformCompany,
    );
    const serviceB = new ContractsService(
      signalContractLockAttempt(second, secondAttempted) as any,
      docusign,
      notifications,
      platformCompany,
    );
    const dto = {
      process_id: processId,
      template_id: 'test-template',
      seller_name: 'Independent Seller',
      seller_email: `seller-${suffix}@example.test`,
      buyer_name: 'Contract Client',
      buyer_email: `contract-client-${suffix}@example.test`,
      vehicle_model: 'Test Vehicle',
      vehicle_year: '2026',
      vehicle_price: 100000,
      payment_seller_value: 90000,
      total_commission_rate: 10,
      platform_name: 'Platform',
      specialist_name: 'Contract Specialist',
      specialist_email: `contract-specialist-${suffix}@example.test`,
      city: 'São Paulo',
    } as any;

    const outcomesPromise = Promise.allSettled([
      serviceA.generateContract(dto, specialistId),
      serviceB.generateContract(dto, specialistId),
    ]);
    await Promise.all([firstAttempted.promise, secondAttempted.promise]);
    releaseHolder.resolve();
    await held;
    const outcomes = await outcomesPromise;

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ContractAlreadyExistsException),
    });
    expect(createEnvelopeFromTemplate).toHaveBeenCalledTimes(1);

    const [process, contracts] = await Promise.all([
      first.process.findUniqueOrThrow({ where: { id: processId } }),
      first.contract.findMany({ where: { process_id: processId } }),
    ]);
    expect(process).toMatchObject({
      status: ProcessStatus.PROCESSING_CONTRACT,
      active_contract_id: contracts[0]?.id,
    });
    expect(contracts).toHaveLength(1);
  }, 10_000);

  it('serializes the public preview-send path so the provider is called once', async () => {
    const firstAttempted = deferred();
    const secondAttempted = deferred();
    const holderReady = deferred();
    const releaseHolder = deferred();
    const lockKey = `contract-process:${sendProcessId}`;
    const held = holder.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      holderReady.resolve();
      await releaseHolder.promise;
    });
    await holderReady.promise;

    const sendDraftEnvelope = jest.fn().mockResolvedValue({
      envelopeId: 'send-envelope',
      status: EnvelopeStatus.SENT,
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue(sendProcessId),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'send-envelope',
        status: EnvelopeStatus.CREATED,
      }),
      sendDraftEnvelope,
      voidDraftEnvelope: jest.fn(),
    } as any;
    const platformCompany = {
      findOne: jest.fn().mockResolvedValue({ default_commission_rate: 10 }),
    } as any;
    const serviceA = new ContractsService(
      signalContractLockAttempt(first, firstAttempted) as any,
      docusign,
      { sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined) } as any,
      platformCompany,
    );
    const serviceB = new ContractsService(
      signalContractLockAttempt(second, secondAttempted) as any,
      docusign,
      { sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined) } as any,
      platformCompany,
    );
    const dto = contractDto(sendProcessId, suffix);

    const outcomesPromise = Promise.allSettled([
      serviceA.sendContractAfterPreview('send-envelope', dto, specialistId),
      serviceB.sendContractAfterPreview('send-envelope', dto, specialistId),
    ]);
    await Promise.all([firstAttempted.promise, secondAttempted.promise]);
    releaseHolder.resolve();
    await held;
    const outcomes = await outcomesPromise;

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ContractAlreadyExistsException),
    });
    expect(sendDraftEnvelope).toHaveBeenCalledTimes(1);
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
  }, 10_000);

  it('never voids a persisted envelope when commit acknowledgement is lost and a retry wins the lock', async () => {
    const committed = deferred();
    const releaseAck = deferred();
    const sendDraftEnvelope = jest.fn().mockResolvedValue({
      envelopeId: 'ambiguous-envelope',
      status: EnvelopeStatus.SENT,
    });
    const docusign = {
      getEnvelopeProcessId: jest.fn().mockResolvedValue(ambiguousCommitProcessId),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId: 'ambiguous-envelope',
        status: EnvelopeStatus.SENT,
      }),
      sendDraftEnvelope,
      voidDraftEnvelope: jest.fn(),
    } as any;
    const platformCompany = {
      findOne: jest.fn().mockResolvedValue({ default_commission_rate: 10 }),
    } as any;
    const firstAttempt = new ContractsService(
      failCommittedTransactionAck(first, committed, releaseAck) as any,
      docusign,
      { sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined) } as any,
      platformCompany,
    );
    const retry = new ContractsService(
      second as any,
      docusign,
      { sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined) } as any,
      platformCompany,
    );
    const dto = contractDto(ambiguousCommitProcessId, suffix);

    const firstResult = firstAttempt.sendContractAfterPreview(
      'ambiguous-envelope',
      dto,
      specialistId,
    );
    await committed.promise;
    await expect(
      retry.sendContractAfterPreview('ambiguous-envelope', dto, specialistId),
    ).rejects.toBeInstanceOf(ContractAlreadyExistsException);
    releaseAck.resolve();

    await expect(firstResult).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: {
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          details: expect.objectContaining({
            process_id: ambiguousCommitProcessId,
            envelope_id: 'ambiguous-envelope',
            correlation_id: expect.any(String),
          }),
        },
      },
    });
    expect(sendDraftEnvelope).toHaveBeenCalledTimes(1);
    expect(docusign.voidDraftEnvelope).not.toHaveBeenCalled();
    const process = await first.process.findUniqueOrThrow({
      where: { id: ambiguousCommitProcessId },
      include: { active_contract: true },
    });
    expect(process.active_contract?.provider_id).toBe('ambiguous-envelope');
  }, 10_000);
});

function contractDto(processId: string, suffix: string) {
  return {
    process_id: processId,
    template_id: 'test-template',
    seller_name: 'Independent Seller',
    seller_email: `seller-${suffix}@example.test`,
    buyer_name: 'Contract Client',
    buyer_email: `contract-client-${suffix}@example.test`,
    vehicle_model: 'Test Vehicle',
    vehicle_year: '2026',
    vehicle_price: 100000,
    payment_seller_value: 90000,
    total_commission_rate: 10,
    platform_name: 'Platform',
    specialist_name: 'Contract Specialist',
    specialist_email: `contract-specialist-${suffix}@example.test`,
    city: 'São Paulo',
  } as any;
}
