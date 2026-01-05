import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getAdminStats() {
    return this.dashboardService.getAdminStats();
  }

  @Get('specialist-stats/:specialistId')
  getSpecialistStats(@Param('specialistId') specialistId: string) {
    return this.dashboardService.getSpecialistStats(specialistId);
  }
}

