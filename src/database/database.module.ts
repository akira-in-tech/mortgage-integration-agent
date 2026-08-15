import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from './entities/loan-application.entity';
import { Tenant } from './entities/tenant.entity';
import { LoanCase } from './entities/loan-case.entity';
import { EvidenceFact } from './entities/evidence-fact.entity';
import { LoanCondition } from './entities/loan-condition.entity';
import { ConditionTransition } from './entities/condition-transition.entity';

/**
 * DatabaseModule registers all entities and can be used as a central place
 * to add database health checks, migrations runner, or seeding logic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoanApplication,
      Tenant,
      LoanCase,
      EvidenceFact,
      LoanCondition,
      ConditionTransition,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
