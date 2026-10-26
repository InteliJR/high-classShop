import { Controller, Get, Optional, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ProductImportJobsService } from './product-import-jobs.service';
import { ActorContextService } from 'src/shared/actor-context/actor-context.service';

@Controller('product-import-jobs')
export class ProductImportJobsController {
  constructor(
    private readonly productImportJobsService: ProductImportJobsService,
    @Optional() private readonly actorContextService?: ActorContextService,
  ) {}

  @Get(':jobId')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async getJobStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: UserEntity,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ) {
    const context = this.actorContextService
      ? await this.actorContextService.resolve(user, targetSpecialistId)
      : undefined;
    return this.productImportJobsService.getJobStatus(
      jobId,
      user,
      context?.specialistId,
    );
  }
}
