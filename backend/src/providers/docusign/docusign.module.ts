import { Module } from '@nestjs/common';
import { DocuSignService } from './docusign.service';
import { DocuSignClient } from './docusign.client';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { requiredEnv } from 'src/shared/utils/required-env';
import { TestController } from './docusign-test.controller';
import { PdfService } from './pdf.service';
import { WebhookController } from './webhook/webhook.controller';
import { DocuSignWebhookService } from './webhook/webhook.service';
import { WebhookSignatureValidator } from './webhook/webhook-signature.validator';
import { PrismaService } from 'src/prisma/prisma.service';
import { AwsModule } from 'src/aws/aws.module';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [ConfigModule, AwsModule, NotificationModule],
  providers: [
    DocuSignService,
    PdfService,
    DocuSignWebhookService,
    WebhookSignatureValidator,
    PrismaService,
    {
      provide: DocuSignClient,
      useFactory: (configService: ConfigService) => {
        const integrationKey = requiredEnv(
          configService.get<string>('DOCUSIGN_INTEGRATION_KEY'),
          'DOCUSIGN_INTEGRATION_KEY',
        );

        const userId = requiredEnv(
          configService.get<string>('DOCUSIGN_USER_ID'),
          'DOCUSIGN_USER_ID',
        );

        const accountId = requiredEnv(
          configService.get<string>('DOCUSIGN_ACCOUNT_ID'),
          'DOCUSIGN_ACCOUNT_ID',
        );

        const privateKey = requiredEnv(
          configService.get<string>('DOCUSIGN_PRIVATE_KEY'),
          'DOCUSIGN_PRIVATE_KEY',
        );

        const environment =
          configService.get<'demo' | 'prod'>('DOCUSIGN_ENV') ?? 'demo';

        return new DocuSignClient(
          integrationKey,
          userId,
          accountId,
          privateKey,
          environment,
        );
      },
      inject: [ConfigService],
    },
  ],
  controllers: [TestController, WebhookController],
  exports: [
    DocuSignClient,
    DocuSignService,
    PdfService,
    DocuSignWebhookService,
  ],
})
export class DocusignModule {}
