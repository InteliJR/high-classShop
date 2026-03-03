import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { S3Service } from 'src/aws/s3.service';
import { CsvImportService } from 'src/shared/services/csv-import.service';

@Module({
  controllers: [CarsController],
  providers: [CarsService, S3Service, CsvImportService],
})
export class CarsModule {}
