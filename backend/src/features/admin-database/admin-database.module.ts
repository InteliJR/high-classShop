import { Module } from '@nestjs/common';
import { AdminDatabaseService } from './admin-database.service';
import { AdminDatabaseController } from './admin-database.controller';
import { AdminUserManagementService } from './admin-user-management.service';
import { AdminProcessRemovalService } from './admin-process-removal.service';

@Module({
  controllers: [AdminDatabaseController],
  providers: [
    AdminDatabaseService,
    AdminUserManagementService,
    AdminProcessRemovalService,
  ],
  exports: [AdminDatabaseService],
})
export class AdminDatabaseModule {}
