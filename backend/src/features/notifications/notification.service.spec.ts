import { ProductCurrency } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SesService } from 'src/aws/ses.service';
import { NotificationService } from './notification.service';

describe('NotificationService proposal emails', () => {
  let service: NotificationService;
  let sendEmailSafely: jest.Mock;

  beforeEach(() => {
    const sesService = { sesClient: {} } as SesService;
    const configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        if (key === 'NOTIFICATIONS_ENABLED') return 'true';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new NotificationService(sesService, configService);
    sendEmailSafely = jest
      .spyOn(service as any, 'sendEmailSafely')
      .mockResolvedValue(undefined);
  });

  it('uses USD in the received proposal HTML and plain-text bodies', async () => {
    await service.sendProposalReceivedEmail({
      recipientEmail: 'buyer@example.com',
      recipientName: 'Buyer',
      proposerName: 'Seller',
      proposedValue: 90000,
      originalValue: 120000,
      currency: ProductCurrency.USD,
      processId: 'process-1',
    });

    const [, , , htmlBody, textBody] = sendEmailSafely.mock.calls[0];
    expect(htmlBody).toContain('US$');
    expect(textBody).toContain('US$');
    expect(JSON.stringify(sendEmailSafely.mock.calls[0])).not.toContain('R$');
  });

  it('uses USD in the accepted proposal HTML and plain-text bodies', async () => {
    await service.sendProposalAcceptedEmail({
      proposerEmail: 'seller@example.com',
      proposerName: 'Seller',
      recipientName: 'Buyer',
      acceptedValue: 90000,
      currency: ProductCurrency.USD,
      processId: 'process-1',
    });

    const [, , , htmlBody, textBody] = sendEmailSafely.mock.calls[0];
    expect(htmlBody).toContain('US$');
    expect(textBody).toContain('US$');
    expect(JSON.stringify(sendEmailSafely.mock.calls[0])).not.toContain('R$');
  });

  it('uses USD in the rejected proposal HTML and plain-text bodies', async () => {
    await service.sendProposalRejectedEmail({
      proposerEmail: 'seller@example.com',
      proposerName: 'Seller',
      recipientName: 'Buyer',
      rejectedValue: 90000,
      currency: ProductCurrency.USD,
      processId: 'process-1',
    });

    const [, , , htmlBody, textBody] = sendEmailSafely.mock.calls[0];
    expect(htmlBody).toContain('US$');
    expect(textBody).toContain('US$');
    expect(JSON.stringify(sendEmailSafely.mock.calls[0])).not.toContain('R$');
  });

  it('keeps BRL in received proposal HTML and plain-text bodies', async () => {
    await service.sendProposalReceivedEmail({
      recipientEmail: 'buyer@example.com',
      recipientName: 'Buyer',
      proposerName: 'Seller',
      proposedValue: 90000,
      originalValue: 120000,
      currency: ProductCurrency.BRL,
      processId: 'process-1',
    });

    const [, , , htmlBody, textBody] = sendEmailSafely.mock.calls[0];
    expect(htmlBody).toContain('R$');
    expect(textBody).toContain('R$');
  });
});
