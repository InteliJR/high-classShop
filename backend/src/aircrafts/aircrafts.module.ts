import { Module } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { AircraftsController } from './aircrafts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService, PrismaService, S3Service],
})
export class AircraftsModule {}
