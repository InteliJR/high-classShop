import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService, S3Service],
})
export class ContractsModule {}
