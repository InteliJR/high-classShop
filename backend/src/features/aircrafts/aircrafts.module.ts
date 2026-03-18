import { Module } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { AircraftsController } from './aircrafts.controller';
import { S3Service } from 'src/aws/s3.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService, S3Service, XlsxImportService],
})
export class AircraftsModule {}
