import { Module } from '@nestjs/common';
import { PlatformCompanyService } from './platform-company.service';
import { PlatformCompanyController } from './platform-company.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [PlatformCompanyController],
  providers: [PlatformCompanyService, PrismaService],
  exports: [PlatformCompanyService],
})
export class PlatformCompanyModule {}
