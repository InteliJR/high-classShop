import { Module } from '@nestjs/common';
import { DriveImportController } from './drive-import.controller';
import { DriveImportService } from './drive-import.service';
import { S3Service } from 'src/aws/s3.service';

@Module({
  controllers: [DriveImportController],
  providers: [DriveImportService, S3Service],
  exports: [DriveImportService],
})
export class DriveImportModule {}
