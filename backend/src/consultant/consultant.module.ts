import { Module } from '@nestjs/common';
import { ConsultantController } from './consultant.controller';
import { ConsultantService } from './consultant.service';
import { PrismaService } from '../prisma/prisma.service';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [AwsModule],
  controllers: [ConsultantController],
  providers: [ConsultantService, PrismaService],
})
export class ConsultantModule {}
