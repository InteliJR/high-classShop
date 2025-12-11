import { Module } from '@nestjs/common';
import { DocusignService } from './docusign.service';
import { DocuSignClient } from './docusign.client';
import { ConfigService } from '@nestjs/config';
import { requiredEnv } from 'src/shared/utils/required-env';

@Module({
  providers: [
    DocusignService,
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
    },
  ],
  exports: [DocuSignClient],
})
export class DocusignModule {}
