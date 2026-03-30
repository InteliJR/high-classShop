import { Module } from '@nestjs/common';
import { BoatsService } from './boats.service';
import { BoatsController } from './boats.controller';
import { S3Service } from 'src/aws/s3.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';
import { ProductImportJobsModule } from '../product-import-jobs/product-import-jobs.module';

@Module({
  imports: [ProductImportJobsModule],
  controllers: [BoatsController],
  providers: [BoatsService, S3Service, XlsxImportService],
})
export class BoatsModule {}
