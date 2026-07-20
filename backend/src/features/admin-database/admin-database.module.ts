import { Module } from '@nestjs/common';
import { AdminDatabaseService } from './admin-database.service';
import { AdminDatabaseController } from './admin-database.controller';

@Module({
  controllers: [AdminDatabaseController],
  providers: [AdminDatabaseService],
})
export class AdminDatabaseModule {}
