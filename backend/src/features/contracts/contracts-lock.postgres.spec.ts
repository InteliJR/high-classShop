import { PrismaClient, ProcessStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ContractsService } from './contracts.service';
import { ContractAlreadyExistsException } from '../../shared/exceptions/custom-exceptions';

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
    await first.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        status: ProcessStatus.DOCUMENTATION,
        negotiation_currency: 'BRL',
        negotiation_product_value: 100000,
      },
    });
  });

  afterAll(async () => {
    await first.process.updateMany({
      where: { id: processId },
      data: { active_contract_id: null },
    });
    await first.contract.deleteMany({ where: { process_id: processId } });
    await first.process.deleteMany({ where: { id: processId } });
    await first.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  });

  it('lets only one external generation win with one connection per pool and preserves status', async () => {
    let envelopeSequence = 0;
    const createEnvelopeFromTemplate = jest.fn(async () => {
      envelopeSequence += 1;
      return { envelopeId: randomUUID(), status: 'sent' };
    });
    const docusign = { createEnvelopeFromTemplate } as any;
    const notifications = {
      sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const platformCompany = {
      findOne: jest.fn().mockResolvedValue({ default_commission_rate: 10 }),
    } as any;
    const serviceA = new ContractsService(
      first as any,
      docusign,
      notifications,
      platformCompany,
    );
    const serviceB = new ContractsService(
      second as any,
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

    const outcomes = await Promise.allSettled([
      serviceA.generateContract(dto, specialistId),
      serviceB.generateContract(dto, specialistId),
    ]);

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
});
