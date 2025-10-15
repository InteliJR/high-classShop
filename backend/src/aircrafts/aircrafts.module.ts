import { Module } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { AircraftsController } from './aircrafts.controller';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService],
})
export class AircraftsModule {}
