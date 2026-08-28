import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseTimelineService } from './case-timeline.service';
import { CaseQueryService } from './case-query.service';
import { CasesResolver, CasePolicyBindingResolver } from './cases.resolver';
import { LoanCase } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { AgentRun } from '../database/entities/agent-run.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { ApiClient } from '../database/entities/api-client.entity';
import { TemporalModule } from '../workflows/temporal.module';
import { AuditModule } from '../audit/audit.module';
import { PolicyModule } from '../policy/policy.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoanCase,
      Tenant,
      Jurisdiction,
      OutboxEvent,
      AgentRun,
      ToolAttempt,
      LoanCondition,
      EvidenceFact,
      CasePolicyBinding,
      CasePolicySnapshot,
      ProviderOperationIntent,
      AuditEvent,
      ApiClient,
    ]),
    TemporalModule,
    AuditModule,
    PolicyModule,
    CommunicationsModule,
  ],
  controllers: [CasesController],
  providers: [
    CasesService,
    CaseTimelineService,
    CaseQueryService,
    CasesResolver,
    CasePolicyBindingResolver,
  ],
})
export class CasesModule {}
