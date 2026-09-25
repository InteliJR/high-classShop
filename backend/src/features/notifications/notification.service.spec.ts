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

  it('describes the meeting without prematurely inviting negotiation', async () => {
    await service.sendAppointmentConfirmedEmail({
      clientEmail: 'client@example.com',
      clientName: 'Client',
      specialistName: 'Specialist',
      appointmentDate: new Date('2099-09-20T15:00:00.000Z'),
      productDetails: 'Porsche 911',
      processId: 'process-1',
    });

    const serialized = JSON.stringify(sendEmailSafely.mock.calls[0]);
    expect(serialized).toContain('reunião');
    expect(serialized).not.toContain('iniciar a negociação');
  });

  it('escapes user-controlled fields in confirmed appointment HTML', async () => {
    await service.sendAppointmentConfirmedEmail({
      clientEmail: 'client@example.com',
      clientName: '<img src=x onerror=alert(1)>',
      specialistName: '<b>Specialist</b>',
      appointmentDate: new Date('2099-09-20T15:00:00.000Z'),
      productDetails: '<script>alert(1)</script>',
      processId: 'process-1',
    });

    const htmlBody = sendEmailSafely.mock.calls[0][3];
    expect(htmlBody).toContain('&lt;img');
    expect(htmlBody).toContain('&lt;b&gt;Specialist&lt;/b&gt;');
    expect(htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlBody).not.toContain('<img src=x');
    expect(htmlBody).not.toContain('<script>alert(1)</script>');
  });

  it('escapes user-controlled fields in created appointment HTML', async () => {
    await service.sendAppointmentCreatedEmail({
      specialistEmail: 'specialist@example.com',
      specialistName: '<img src=x onerror=alert(1)>',
      clientName: '<b>Client</b>',
      appointmentDate: new Date('2099-09-20T15:00:00.000Z'),
      productDetails: '<script>alert(1)</script>',
      processId: 'process-1',
    });

    const htmlBody = sendEmailSafely.mock.calls[0][3];
    expect(htmlBody).toContain('&lt;img');
    expect(htmlBody).toContain('&lt;b&gt;Client&lt;/b&gt;');
    expect(htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlBody).not.toContain('<img src=x');
    expect(htmlBody).not.toContain('<script>alert(1)</script>');
  });

  it('includes previous and definitive datetimes in reschedule email', async () => {
    await (service as any).sendAppointmentRescheduledEmail({
      clientEmail: 'client@example.com',
      clientName: 'Client',
      specialistName: 'Specialist',
      previousAppointmentDate: new Date('2099-09-20T15:00:00.000Z'),
      appointmentDate: new Date('2099-09-21T16:00:00.000Z'),
      productDetails: 'Porsche 911',
      processId: 'process-1',
    });

    const serialized = JSON.stringify(sendEmailSafely.mock.calls[0]);
    expect(serialized).toContain('20/09/2099');
    expect(serialized).toContain('21/09/2099');
    expect(serialized).toContain('definitivo');
  });

  it('escapes user-controlled fields in reschedule email HTML', async () => {
    await service.sendAppointmentRescheduledEmail({
      clientEmail: 'client@example.com',
      clientName: '<img src=x onerror=alert(1)>',
      specialistName: '<b>Specialist</b>',
      previousAppointmentDate: new Date('2099-09-20T15:00:00.000Z'),
      appointmentDate: new Date('2099-09-21T16:00:00.000Z'),
      productDetails: '<script>alert(1)</script>',
      processId: 'process-1',
    });

    const htmlBody = sendEmailSafely.mock.calls[0][3];
    expect(htmlBody).toContain('&lt;img');
    expect(htmlBody).toContain('&lt;b&gt;Specialist&lt;/b&gt;');
    expect(htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlBody).not.toContain('<img src=x');
    expect(htmlBody).not.toContain('<script>alert(1)</script>');
  });
});
