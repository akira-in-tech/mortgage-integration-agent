import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentBudgetLedger } from '../database/entities/agent-budget-ledger.entity';
import { AgentBudgetReservation } from '../database/entities/agent-budget-reservation.entity';
import { AgentBudgetLedgerService } from './agent-budget-ledger.service';
import { AgentBudgetController } from './agent-budget.controller';
import { TenantAgentBudgetUsage } from '../database/entities/tenant-agent-budget-usage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentBudgetLedger,
      AgentBudgetReservation,
      TenantAgentBudgetUsage,
    ]),
  ],
  controllers: [AgentBudgetController],
  providers: [AgentBudgetLedgerService],
  exports: [AgentBudgetLedgerService],
})
export class AgentBudgetModule {}
