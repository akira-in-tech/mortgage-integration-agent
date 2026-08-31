import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from './entities/loan-application.entity';
import { Tenant } from './entities/tenant.entity';
import { LoanCase } from './entities/loan-case.entity';
import { EvidenceFact } from './entities/evidence-fact.entity';
import { LoanCondition } from './entities/loan-condition.entity';
import { ConditionTransition } from './entities/condition-transition.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { Jurisdiction } from './entities/jurisdiction.entity';
import { PolicySource } from './entities/policy-source.entity';
import { PolicySourceRevision } from './entities/policy-source-revision.entity';
import { PolicyVersion } from './entities/policy-version.entity';
import { PolicyApplicability } from './entities/policy-applicability.entity';
import { CasePolicySnapshot } from './entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from './entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from './entities/policy-catalog-generation.entity';
import { PolicyChangeImpactAssessment } from './entities/policy-change-impact-assessment.entity';
import { CommunicationTemplate } from './entities/communication-template.entity';
import { CommunicationMessage } from './entities/communication-message.entity';
import { CommunicationApproval } from './entities/communication-approval.entity';
import { DocumentRecord } from './entities/document-record.entity';

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
      OutboxEvent,
      Jurisdiction,
      PolicySource,
      PolicySourceRevision,
      PolicyVersion,
      PolicyApplicability,
      CasePolicySnapshot,
      CasePolicyBinding,
      PolicyCatalogGeneration,
      PolicyChangeImpactAssessment,
      CommunicationTemplate,
      CommunicationMessage,
      CommunicationApproval,
      DocumentRecord,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
