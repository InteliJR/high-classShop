import { Controller, Get, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ProductImportJobsService } from './product-import-jobs.service';

@Controller('product-import-jobs')
export class ProductImportJobsController {
  constructor(
    private readonly productImportJobsService: ProductImportJobsService,
  ) {}

  @Get(':jobId')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  getJobStatus(@Param('jobId') jobId: string, @CurrentUser() user: UserEntity) {
    return this.productImportJobsService.getJobStatus(jobId, user);
  }
}
