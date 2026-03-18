import { Module } from '@nestjs/common';
import { PlatformCompanyService } from './platform-company.service';
import { PlatformCompanyController } from './platform-company.controller';

@Module({
  controllers: [PlatformCompanyController],
  providers: [PlatformCompanyService],
  exports: [PlatformCompanyService],
})
export class PlatformCompanyModule {}
