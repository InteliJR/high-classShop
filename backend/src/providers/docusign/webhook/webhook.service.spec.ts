import { ProcessStatus, ProviderStatus } from '@prisma/client';
import { DocuSignWebhookService } from './webhook.service';

const completedPayload = {
  event: 'envelope-completed',
  generatedDateTime: '2026-09-04T12:00:00.000Z',
  retryCount: 0,
  configurationId: 1,
  apiVersion: 'v2.1',
  data: { envelopeId: 'envelope-1', accountId: 'account-1', userId: 'user-1' },
};

describe('DocuSignWebhookService monotonic convergence', () => {
  it('returns a retryable error when the webhook arrives before local insertion', async () => {
    const prisma = {
      contract: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const service = new DocuSignWebhookService(prisma, {} as any);

    await expect(
      service.handleEnvelopeStatusChanged(completedPayload),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('does not downgrade a completed contract with a delayed delivered event', async () => {
    const prisma = {
      contract: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contract-1',
          process_id: 'process-1',
          provider_status: ProviderStatus.COMPLETED,
          status: 'SIGNED',
        }),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new DocuSignWebhookService(prisma, {} as any);

    await service.handleEnvelopeStatusChanged({
      ...completedPayload,
      event: 'envelope-delivered',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('claims a concurrent terminal webhook once and writes explicit history status', async () => {
    let providerStatus = ProviderStatus.SENT;
    const historyCreate = jest.fn().mockResolvedValue({});
    const tx = {
      contract: {
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          if (providerStatus !== where.provider_status) return { count: 0 };
          providerStatus = data.provider_status;
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
          id: 'contract-1',
          process_id: 'process-1',
          provider_status: providerStatus,
          status: 'SIGNED',
          signed_at: new Date(),
        })),
      },
      process: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'process-1',
          status: ProcessStatus.DOCUMENTATION,
          active_contract_id: 'contract-1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      processStatusHistory: { create: historyCreate },
    };
    const prisma = {
      contract: {
        findFirst: jest.fn().mockImplementation(async () => ({
          id: 'contract-1',
          process_id: 'process-1',
          provider_status: providerStatus,
          status: 'PENDING',
          provider_meta: {},
          signed_at: null,
        })),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    } as any;
    const service = new DocuSignWebhookService(prisma, {} as any);

    await Promise.all([
      service.handleEnvelopeStatusChanged(completedPayload),
      service.handleEnvelopeStatusChanged(completedPayload),
    ]);

    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: ProcessStatus.COMPLETED }),
    });
  });
});
