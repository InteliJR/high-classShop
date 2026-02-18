import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocusignModule } from 'src/providers/docusign/docusign.module';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [DocusignModule, NotificationModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService],
})
export class ContractsModule {}
