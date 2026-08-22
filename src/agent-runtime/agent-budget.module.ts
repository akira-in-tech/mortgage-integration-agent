import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentBudgetLedger } from '../database/entities/agent-budget-ledger.entity';
import { AgentBudgetReservation } from '../database/entities/agent-budget-reservation.entity';
import { AgentBudgetLedgerService } from './agent-budget-ledger.service';
import { AgentBudgetController } from './agent-budget.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentBudgetLedger, AgentBudgetReservation]),
  ],
  controllers: [AgentBudgetController],
  providers: [AgentBudgetLedgerService],
  exports: [AgentBudgetLedgerService],
})
export class AgentBudgetModule {}
