import { Module } from '@nestjs/common';
import { BoatsService } from './boats.service';
import { BoatsController } from './boats.controller';

@Module({
  controllers: [BoatsController],
  providers: [BoatsService],
})
export class BoatsModule {}
