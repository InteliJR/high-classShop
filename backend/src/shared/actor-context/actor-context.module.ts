import { Global, Module } from '@nestjs/common';
import { ActorContextService } from './actor-context.service';
import { DelegatedActionAuditService } from './delegated-action-audit.service';

@Global()
@Module({
  providers: [ActorContextService, DelegatedActionAuditService],
  exports: [ActorContextService, DelegatedActionAuditService],
})
export class ActorContextModule {}
