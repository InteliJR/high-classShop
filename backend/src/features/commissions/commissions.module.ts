import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService],
})
export class CommissionsModule {}
