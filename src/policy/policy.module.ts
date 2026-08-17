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
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { PolicyEvaluationService } from './policy-evaluation.service';
import { PolicyChangeImpactService } from './policy-change-impact.service';
import { PolicyActivationService } from './policy-activation.service';
import { EvaluationManifestService } from './evaluation-manifest.service';

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
    ]),
  ],
  providers: [
    PolicyApplicabilityResolverService,
    PolicyEvaluationService,
    PolicyChangeImpactService,
    PolicyActivationService,
    EvaluationManifestService,
  ],
  exports: [
    PolicyApplicabilityResolverService,
    PolicyEvaluationService,
    PolicyChangeImpactService,
    PolicyActivationService,
    EvaluationManifestService,
  ],
})
export class PolicyModule {}
