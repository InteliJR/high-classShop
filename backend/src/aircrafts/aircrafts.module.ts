import { Module } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { AircraftsController } from './aircrafts.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService, PrismaService],
})
export class AircraftsModule {}
