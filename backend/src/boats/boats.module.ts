import { Module } from '@nestjs/common';
import { BoatsService } from './boats.service';
import { BoatsController } from './boats.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [BoatsController],
  providers: [BoatsService, PrismaService],
})
export class BoatsModule {}
