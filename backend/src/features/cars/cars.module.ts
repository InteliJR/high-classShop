import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { S3Service } from 'src/aws/s3.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';
import { ProductImportJobsModule } from '../product-import-jobs/product-import-jobs.module';

@Module({
  imports: [ProductImportJobsModule],
  controllers: [CarsController],
  providers: [CarsService, S3Service, XlsxImportService],
})
export class CarsModule {}
