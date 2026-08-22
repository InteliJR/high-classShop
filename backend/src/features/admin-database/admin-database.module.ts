import { Module } from '@nestjs/common';
import { AdminDatabaseService } from './admin-database.service';
import { AdminDatabaseController } from './admin-database.controller';
import { AdminUserManagementService } from './admin-user-management.service';

@Module({
  controllers: [AdminDatabaseController],
  providers: [AdminDatabaseService, AdminUserManagementService],
  exports: [AdminDatabaseService],
})
export class AdminDatabaseModule {}
