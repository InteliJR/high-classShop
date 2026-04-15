import { Module } from '@nestjs/common';
import { DriveImportModule } from '../drive-import/drive-import.module';
import { ProductImportJobsController } from './product-import-jobs.controller';
import { ProductImportJobsService } from './product-import-jobs.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

@Module({
  imports: [DriveImportModule],
  controllers: [ProductImportJobsController],
  providers: [ProductImportJobsService, XlsxImportService],
  exports: [ProductImportJobsService],
})
export class ProductImportJobsModule {}
