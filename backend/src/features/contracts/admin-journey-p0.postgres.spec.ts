import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  ContractStatus,
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProviderStatus,
  SignatureType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ProcessesService } from '../processes/processes.service';
import { DocuSignWebhookService } from '../../providers/docusign/webhook/webhook.service';
import { ContractsService } from './contracts.service';
import { EnvelopeStatus } from '../../providers/docusign/enums/envelope-status.enum';

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

function completedPayload(envelopeId: string) {
  return {
    event: 'envelope-completed',
    generatedDateTime: '2026-10-23T12:00:00.000Z',
    retryCount: 0,
    configurationId: 1,
    apiVersion: 'v2.1',
    data: {
      envelopeId,
      accountId: 'test-account',
      userId: 'test-provider-user',
    },
  };
}

describeWithPostgres('admin journey P0 — PostgreSQL + simulated DocuSign', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const suffix = randomUUID().replaceAll('-', '');
  const adminId = randomUUID();
  const clientId = randomUUID();
  const specialistId = randomUUID();
  const processIds: string[] = [];

  const notifications = {
    sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
    sendContractGeneratedEmail: jest.fn().mockResolvedValue(undefined),
    sendContractSentEmail: jest.fn().mockResolvedValue(undefined),
    sendContractSignedEmail: jest.fn().mockResolvedValue(undefined),
    sendContractDeclinedEmail: jest.fn().mockResolvedValue(undefined),
    sendContractVoidedEmail: jest.fn().mockResolvedValue(undefined),
    sendContractTimeoutEmail: jest.fn().mockResolvedValue(undefined),
  } as any;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          name: 'P0',
          surname: 'Admin',
          email: `p0-admin-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.ADMIN,
          password_hash: 'not-used',
        },
        {
          id: clientId,
          name: 'P0',
          surname: 'Client',
          email: `p0-client-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'P0',
          surname: 'Specialist',
          email: `p0-specialist-${suffix}@example.test`,
          rg: suffix.slice(21, 32),
          role: UserRole.SPECIALIST,
          password_hash: 'not-used',
          commission_rate: 0,
        },
      ],
    });
  });

  afterEach(async () => {
    if (processIds.length === 0) return;
    await prisma.process.updateMany({
      where: { id: { in: processIds } },
      data: { active_contract_id: null },
    });
    await prisma.contract.deleteMany({
      where: { process_id: { in: processIds } },
    });
    await prisma.processStatusHistory.deleteMany({
      where: { processId: { in: processIds } },
    });
    await prisma.processRejection.deleteMany({
      where: { process_id: { in: processIds } },
    });
    await prisma.process.deleteMany({ where: { id: { in: processIds } } });
    processIds.splice(0);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, clientId, specialistId] } },
    });
    await prisma.$disconnect();
  });

  async function createProcess(status = ProcessStatus.DOCUMENTATION) {
    const id = randomUUID();
    processIds.push(id);
    await prisma.process.create({
      data: {
        id,
        client_id: clientId,
        specialist_id: specialistId,
        status,
        negotiation_currency: ProductCurrency.BRL,
        negotiation_product_value: 100_000,
      },
    });
    return id;
  }

  async function createContract(
    processId: string,
    envelopeId: string,
    providerStatus = ProviderStatus.SENT,
  ) {
    return prisma.contract.create({
      data: {
        process_id: processId,
        provider_name: 'DOCUSIGN',
        provider_id: envelopeId,
        provider_status: providerStatus,
        status: ContractStatus.PENDING,
        signature_type: SignatureType.SIMPLE,
        uploaded_by_id: adminId,
        uploaded_by_type: UserRole.ADMIN,
        signed_by_id: clientId,
        buyer_name: 'P0 Client',
        seller_name: 'P0 Seller',
      },
    });
  }

  it('blocks rejection with a live envelope before a later COMPLETED webhook', async () => {
    const processId = await createProcess();
    const envelopeId = `p0-reject-${suffix}`;
    const contract = await createContract(processId, envelopeId);
    await prisma.process.update({
      where: { id: processId },
      data: { active_contract_id: contract.id },
    });

    const processes = new ProcessesService(prisma as any, notifications);
    let rejectionError: unknown;
    try {
      await processes.rejectProcess(
        processId,
        adminId,
        'admin requested cancellation',
        UserRole.ADMIN,
      );
    } catch (error) {
      rejectionError = error;
    }

    const webhook = new DocuSignWebhookService(prisma as any, notifications);
    await webhook.handleEnvelopeStatusChanged(completedPayload(envelopeId));

    expect(rejectionError).toBeInstanceOf(BadRequestException);
    await expect(
      prisma.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({
      status: ProcessStatus.COMPLETED,
      active_contract_id: contract.id,
    });
    await expect(
      prisma.processStatusHistory.count({
        where: { processId, status: ProcessStatus.REJECTED },
      }),
    ).resolves.toBe(0);
  });

  it('updates an old contract from a delayed webhook without changing the process', async () => {
    const processId = await createProcess();
    const oldEnvelopeId = `p0-old-${suffix}`;
    const oldContract = await createContract(processId, oldEnvelopeId);
    const activeContract = await createContract(
      processId,
      `p0-active-${suffix}`,
    );
    await prisma.process.update({
      where: { id: processId },
      data: { active_contract_id: activeContract.id },
    });

    const webhook = new DocuSignWebhookService(prisma as any, notifications);
    await webhook.handleEnvelopeStatusChanged(completedPayload(oldEnvelopeId));

    await expect(
      prisma.contract.findUniqueOrThrow({ where: { id: oldContract.id } }),
    ).resolves.toMatchObject({
      provider_status: ProviderStatus.COMPLETED,
      status: ContractStatus.SIGNED,
    });
    await expect(
      prisma.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({
      status: ProcessStatus.DOCUMENTATION,
      active_contract_id: activeContract.id,
    });
    await expect(
      prisma.processStatusHistory.count({
        where: { processId, status: ProcessStatus.COMPLETED },
      }),
    ).resolves.toBe(0);
  });

  it('rejects a send DTO whose legal content differs from the approved preview', async () => {
    const processId = await createProcess(ProcessStatus.PROCESSING_CONTRACT);
    const envelopeId = `p0-preview-${suffix}`;
    let previewFingerprint = '';
    const docusign = {
      createEnvelopePreview: jest.fn().mockImplementation(async (params) => {
        previewFingerprint = params.requestFingerprint;
        params.onEnvelopeCreated?.(envelopeId);
        return {
          envelopeId,
          previewUrl: 'https://docusign.example.test/preview',
          expiresAt: '2099-01-01T00:00:00.000Z',
        };
      }),
      getEnvelopeProcessId: jest.fn().mockResolvedValue(processId),
      getEnvelopeRequestFingerprint: jest
        .fn()
        .mockImplementation(async () => previewFingerprint),
      getEnvelopeStatus: jest.fn().mockResolvedValue({
        envelopeId,
        status: EnvelopeStatus.CREATED,
      }),
      sendDraftEnvelope: jest.fn().mockResolvedValue({
        envelopeId,
        status: EnvelopeStatus.SENT,
      }),
      voidDraftEnvelope: jest.fn().mockResolvedValue(undefined),
    } as any;
    const platformCompany = {
      findOne: jest.fn().mockResolvedValue({ default_commission_rate: 10 }),
    } as any;
    const contracts = new ContractsService(
      prisma as any,
      docusign,
      notifications,
      platformCompany,
    );
    const approvedDto = {
      operation_id: randomUUID(),
      return_url: 'https://app.example.test/contracts/return',
      process_id: processId,
      template_id: 'template-p0',
      seller_name: 'Approved Seller',
      seller_email: 'seller@example.test',
      buyer_name: 'P0 Client',
      buyer_email: `p0-client-${suffix}@example.test`,
      specialist_name: 'P0 Specialist',
      specialist_email: `p0-specialist-${suffix}@example.test`,
      vehicle_model: 'Approved Model',
      vehicle_year: '2026',
      vehicle_price: 100_000,
      payment_seller_value: 90_000,
      total_commission_rate: 10,
      city: 'Sao Paulo',
      description: 'Approved legal content',
    } as any;

    const preview = await contracts.previewContract(approvedDto, adminId);
    await expect(
      contracts.sendContractAfterPreview(
        preview.envelope_id,
        {
          ...approvedDto,
          seller_name: 'Tampered Seller',
          vehicle_price: 1,
        },
        adminId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(docusign.sendDraftEnvelope).not.toHaveBeenCalled();
    await expect(
      prisma.contract.count({ where: { process_id: processId } }),
    ).resolves.toBe(0);
  });
});
