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
import { TemporalModule } from '../workflows/temporal.module';

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
    ]),
    TemporalModule,
  ],
  controllers: [CasesController],
  providers: [CasesService, CaseTimelineService],
})
export class CasesModule {}
