import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseTimelineService } from './case-timeline.service';
import { LoanCase } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { AgentRun } from '../database/entities/agent-run.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { ApiClient } from '../database/entities/api-client.entity';
import { TemporalModule } from '../workflows/temporal.module';
import { AuditModule } from '../audit/audit.module';
import { PolicyModule } from '../policy/policy.module';

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
      ApiClient,
    ]),
    TemporalModule,
    AuditModule,
    PolicyModule,
  ],
  controllers: [CasesController],
  providers: [CasesService, CaseTimelineService],
})
export class CasesModule {}
