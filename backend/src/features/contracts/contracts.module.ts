import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocusignModule } from 'src/providers/docusign/docusign.module';
import { NotificationModule } from 'src/features/notifications/notification.module';
import { PlatformCompanyModule } from 'src/features/platform-company/platform-company.module';

@Module({
  imports: [DocusignModule, NotificationModule, PlatformCompanyModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService],
})
export class ContractsModule {}
