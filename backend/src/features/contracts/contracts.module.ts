import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocusignModule } from 'src/providers/docusign/docusign.module';
import { AwsModule } from 'src/aws/aws.module';

@Module({
  imports: [DocusignModule, AwsModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService],
})
export class ContractsModule {}
