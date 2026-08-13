import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanResolver } from './loan.resolver';
import { LoanService } from './loan.service';
import { LoanApplication } from '../database/entities/loan-application.entity';
import { ApiKeyGuard } from '../common/api-key.guard';
import { GraphqlThrottlerGuard } from '../common/graphql-throttler.guard';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication]), AgentModule],
  providers: [LoanResolver, LoanService, ApiKeyGuard, GraphqlThrottlerGuard],
})
export class LoanModule {}
