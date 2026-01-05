import { Module } from '@nestjs/common';
import { BoatsService } from './boats.service';
import { BoatsController } from './boats.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { CsvImportService } from 'src/shared/services/csv-import.service';

@Module({
  controllers: [BoatsController],
  providers: [BoatsService, PrismaService, S3Service, CsvImportService],
})
export class BoatsModule {}
