import { Module } from '@nestjs/common';
import { SpecialistsService } from './specialists.service';
import { SpecialistsController } from './specialists.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [SpecialistsController],
  providers: [SpecialistsService, PrismaService],
})
export class SpecialistsModule {}
