import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { AdminDatabaseModule } from '../admin-database/admin-database.module';

@Module({
  imports: [CommissionsModule, AdminDatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
