import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { EvaluationInputManifest } from '../database/entities/evaluation-input-manifest.entity';
import { PolicyTransitionApproval } from '../database/entities/policy-transition-approval.entity';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { PolicyEvaluationService } from './policy-evaluation.service';
import { PolicyChangeImpactService } from './policy-change-impact.service';
import { PolicyActivationService } from './policy-activation.service';
import { EvaluationManifestService } from './evaluation-manifest.service';
import { PolicyTransitionApprovalService } from './policy-transition-approval.service';
import { PolicySourceMonitorService } from './policy-source-monitor.service';
import { PolicyCatalogController } from './policy-catalog.controller';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PolicyResearchRun } from '../database/entities/policy-research-run.entity';
import { PolicyResearchCitation } from '../database/entities/policy-research-citation.entity';
import { PolicyResearchService } from './policy-research.service';
import { PolicyResearchController } from './policy-research.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Jurisdiction,
      PolicySource,
      PolicySourceRevision,
      PolicyVersion,
      PolicyApplicability,
      CasePolicySnapshot,
      CasePolicyBinding,
      PolicyCatalogGeneration,
      PolicyChangeImpactAssessment,
      LoanCase,
      EvaluationInputManifest,
      PolicyTransitionApproval,
      PlatformAdmin,
      PolicyResearchRun,
      PolicyResearchCitation,
    ]),
  ],
  controllers: [PolicyCatalogController, PolicyResearchController],
  providers: [
    PolicyApplicabilityResolverService,
    PolicyEvaluationService,
    PolicyChangeImpactService,
    PolicyActivationService,
    EvaluationManifestService,
    PolicyTransitionApprovalService,
    PolicySourceMonitorService,
    PolicyResearchService,
    PlatformAdminGuard,
  ],
  exports: [
    PolicyApplicabilityResolverService,
    PolicyEvaluationService,
    PolicyChangeImpactService,
    PolicyActivationService,
    EvaluationManifestService,
    PolicyTransitionApprovalService,
    PolicySourceMonitorService,
    PolicyResearchService,
  ],
})
export class PolicyModule {}
