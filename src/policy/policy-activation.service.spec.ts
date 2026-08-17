import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyChangeImpactKind } from '../database/enums/policy-change-impact.enum';
import { LoanType } from '../database/enums/loan-type.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { PolicyEvaluationService } from './policy-evaluation.service';
import { PolicyChangeImpactService } from './policy-change-impact.service';
import { PolicyActivationService } from './policy-activation.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const PRODUCT_CODE = 'CONVENTIONAL_MORTGAGE';
const LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';
// Each test that creates a case + binding uses its own jurisdiction code
// so PolicyChangeImpactService's "find cases matching this
// jurisdiction/product" scan can never sweep up a case from a different
// test — the codebase's established isolation pattern.
const JURISDICTION_CODES = [
  'US-PAS-BASE',
  'US-PAS-REEVAL',
  'US-PAS-AMBIG',
  'US-PAS-PERCASE',
] as const;

describeOrSkip('PolicyActivationService + PolicyChangeImpactService', () => {
  let dataSource: DataSource;
  let resolver: PolicyApplicabilityResolverService;
  let evaluationService: PolicyEvaluationService;
  let impactService: PolicyChangeImpactService;
  let activationService: PolicyActivationService;
  let tenantId: string;
  const caseIds: string[] = [];
  const versionIds: string[] = [];
  const revisionIds: string[] = [];
  const sourceIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        PolicySource,
        PolicySourceRevision,
        PolicyVersion,
        PolicyApplicability,
        CasePolicySnapshot,
        CasePolicyBinding,
        PolicyCatalogGeneration,
        PolicyChangeImpactAssessment,
      ],
    });
    await dataSource.initialize();

    resolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );
    evaluationService = new PolicyEvaluationService(
      resolver,
      dataSource.getRepository(CasePolicySnapshot),
      dataSource.getRepository(CasePolicyBinding),
      dataSource.getRepository(PolicyCatalogGeneration),
    );
    impactService = new PolicyChangeImpactService(
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(CasePolicyBinding),
      dataSource.getRepository(CasePolicySnapshot),
      dataSource.getRepository(LoanCase),
      dataSource.getRepository(PolicyChangeImpactAssessment),
      resolver,
    );
    activationService = new PolicyActivationService(
      dataSource,
      dataSource.getRepository(PolicyVersion),
      impactService,
    );

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource.getRepository(Tenant).create({ name: 'PAS Spec Tenant' }),
      );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      JURISDICTION_CODES.map((code) =>
        dataSource.getRepository(Jurisdiction).create({
          code,
          level: JurisdictionLevel.STATE,
          name: `PolicyActivationService test (${code})`,
          coverageStatus: JurisdictionCoverageStatus.COVERED,
        }),
      ),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(PolicyChangeImpactAssessment)
        .delete({ tenantId });
      await dataSource.getRepository(CasePolicyBinding).delete({ tenantId });
      await dataSource.getRepository(CasePolicySnapshot).delete({ tenantId });
      if (caseIds.length) {
        await dataSource.getRepository(LoanCase).delete(caseIds);
      }
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      if (versionIds.length) {
        await dataSource
          .getRepository(PolicyApplicability)
          .delete(versionIds.map((id) => ({ policyVersionId: id })));
        await dataSource.getRepository(PolicyVersion).delete(versionIds);
      }
      if (revisionIds.length) {
        await dataSource
          .getRepository(PolicySourceRevision)
          .delete(revisionIds);
      }
      if (sourceIds.length) {
        await dataSource.getRepository(PolicySource).delete(sourceIds);
      }
      await dataSource
        .getRepository(Jurisdiction)
        .delete(JURISDICTION_CODES.map((code) => ({ code })));
      await dataSource.destroy();
    }
  }, 30_000);

  async function seedDraftVersion(
    jurisdictionCode: string,
    ruleId: string,
    version: string,
    releaseStatus: PolicyReleaseStatus = PolicyReleaseStatus.DRAFT,
  ): Promise<string> {
    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: `PAS spec source ${ruleId}-${version}`,
        owner: 'policy-team',
        jurisdictionCode,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    sourceIds.push(source.id);

    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: `sha256:${ruleId}-${version}`,
        publishedAt: new Date('2025-01-01T00:00:00Z'),
        content: {},
      }),
    );
    revisionIds.push(revision.id);

    const dsl = {
      rule: {
        id: ruleId,
        version,
        applicability: {
          jurisdictions: [jurisdictionCode],
          product: PRODUCT_CODE,
          lifecycle_events: [LIFECYCLE_EVENT],
          effective_from: '2025-01-01T00:00:00Z',
        },
        when: {
          difference_percent: {
            left: 'application.monthly_income',
            right: 'evidence.verified_monthly_income',
            greater_than: 10,
          },
        },
        outcome: {
          condition: 'VERIFY_INCOME_DISCREPANCY',
          route: 'MANUAL_REVIEW',
        },
      },
    };

    const versionRepo = dataSource.getRepository(PolicyVersion);
    const policyVersion = await versionRepo.save(
      versionRepo.create({
        ruleId,
        version,
        sourceRevisionId: revision.id,
        dsl,
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        releaseStatus,
      }),
    );
    versionIds.push(policyVersion.id);

    const applicabilityRepo = dataSource.getRepository(PolicyApplicability);
    await applicabilityRepo.save(
      applicabilityRepo.create({
        policyVersionId: policyVersion.id,
        jurisdictionCode,
        productCode: PRODUCT_CODE,
        lifecycleEvent: LIFECYCLE_EVENT,
      }),
    );

    return policyVersion.id;
  }

  async function makeCase(jurisdictionCode: string): Promise<string> {
    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `pas-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'pas-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode,
        status: CaseStatus.DRAFT,
      }),
    );
    caseIds.push(loanCase.id);
    return loanCase.id;
  }

  it('activates a DRAFT version, bumps the catalog generation, and rejects re-activation', async () => {
    const versionId = await seedDraftVersion(
      JURISDICTION_CODES[0],
      'pas-rule-activate',
      '1.0.0',
    );

    const before: Array<{ generation: number }> = await dataSource.query(
      `SELECT generation FROM policy_catalog_generation WHERE id = 1`,
    );

    const result = await activationService.activate(versionId);

    expect(result.generation).toBe(before[0].generation + 1);
    const updated = await dataSource
      .getRepository(PolicyVersion)
      .findOneByOrFail({ id: versionId });
    expect(updated.releaseStatus).toBe(PolicyReleaseStatus.RELEASED);

    await expect(activationService.activate(versionId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('withdraws a RELEASED version, bumps the generation, and rejects re-withdrawal', async () => {
    const versionId = await seedDraftVersion(
      JURISDICTION_CODES[0],
      'pas-rule-withdraw',
      '1.0.0',
      PolicyReleaseStatus.RELEASED,
    );

    const before: Array<{ generation: number }> = await dataSource.query(
      `SELECT generation FROM policy_catalog_generation WHERE id = 1`,
    );

    const result = await activationService.withdraw(versionId);

    expect(result.generation).toBe(before[0].generation + 1);
    const updated = await dataSource
      .getRepository(PolicyVersion)
      .findOneByOrFail({ id: versionId });
    expect(updated.releaseStatus).toBe(PolicyReleaseStatus.WITHDRAWN);

    await expect(activationService.withdraw(versionId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('assesses REQUIRES_REEVALUATION for an open case when the version it is bound to is withdrawn', async () => {
    const jurisdictionCode = JURISDICTION_CODES[1];
    const versionId = await seedDraftVersion(
      jurisdictionCode,
      'pas-rule-reeval',
      '1.0.0',
      PolicyReleaseStatus.RELEASED,
    );
    // Make this version's activation generation the baseline so the
    // case's binding below observes a real, current generation.
    await dataSource.query(
      `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
    );

    const caseId = await makeCase(jurisdictionCode);
    const evaluation = await evaluationService.evaluate(tenantId, caseId, {
      jurisdictionCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2026-01-01T00:00:00Z'),
    });
    expect(evaluation.outcome).toBe('REFRESHED');
    expect(
      evaluation.resolution.versions.map((v) => v.policyVersionId),
    ).toEqual([versionId]);

    const result = await activationService.withdraw(versionId);

    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]).toMatchObject({
      tenantId,
      caseId,
      impact: PolicyChangeImpactKind.REQUIRES_REEVALUATION,
    });
    expect(result.assessments[0].details).toContain(versionId);

    const persisted = await dataSource
      .getRepository(PolicyChangeImpactAssessment)
      .find({ where: { caseId } });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].impact).toBe(
      PolicyChangeImpactKind.REQUIRES_REEVALUATION,
    );

    // Advisory only — the case's binding itself is untouched by the
    // assessment; only a real re-evaluation (PolicyEvaluationService)
    // would refresh it.
    const stillBound = await dataSource
      .getRepository(CasePolicyBinding)
      .findOneByOrFail({ id: evaluation.binding!.id });
    expect(stillBound.invalidatedAt).toBeNull();
  });

  it('assesses AMBIGUOUS when activating a version creates an overlapping-version conflict for a bound case', async () => {
    const jurisdictionCode = JURISDICTION_CODES[2];
    await seedDraftVersion(
      jurisdictionCode,
      'pas-rule-ambiguous',
      '1.0.0',
      PolicyReleaseStatus.RELEASED,
    );
    await dataSource.query(
      `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
    );

    const caseId = await makeCase(jurisdictionCode);
    const evaluation = await evaluationService.evaluate(tenantId, caseId, {
      jurisdictionCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2026-01-01T00:00:00Z'),
    });
    expect(evaluation.outcome).toBe('REFRESHED');

    // A second, independent version of the SAME rule, also effective now
    // — a genuine overlap conflict once activated.
    const conflictingVersionId = await seedDraftVersion(
      jurisdictionCode,
      'pas-rule-ambiguous',
      '1.0.1',
    );
    const result = await activationService.activate(conflictingVersionId);

    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]).toMatchObject({
      tenantId,
      caseId,
      impact: PolicyChangeImpactKind.AMBIGUOUS,
    });
    expect(result.assessments[0].details).toContain('overlapping');
  });

  it('assessImpactForCase assesses one specific case directly, without a catalog-wide scan', async () => {
    const jurisdictionCode = JURISDICTION_CODES[3];
    const versionId = await seedDraftVersion(
      jurisdictionCode,
      'pas-rule-percase',
      '1.0.0',
      PolicyReleaseStatus.RELEASED,
    );
    await dataSource.query(
      `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
    );

    const caseId = await makeCase(jurisdictionCode);
    await evaluationService.evaluate(tenantId, caseId, {
      jurisdictionCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2026-01-01T00:00:00Z'),
    });

    // A newer version withdraws the case's own bound version directly
    // (not via activationService.activate/withdraw's own catalog-wide
    // trigger) — assessImpactForCase must still find the real impact for
    // this one case on demand.
    await dataSource
      .getRepository(PolicyVersion)
      .update(
        { id: versionId },
        { releaseStatus: PolicyReleaseStatus.WITHDRAWN },
      );

    const assessment = await impactService.assessImpactForCase(
      tenantId,
      caseId,
      versionId,
    );

    expect(assessment).toMatchObject({
      tenantId,
      caseId,
      policyVersionId: versionId,
      impact: PolicyChangeImpactKind.REQUIRES_REEVALUATION,
    });

    const persisted = await dataSource
      .getRepository(PolicyChangeImpactAssessment)
      .find({ where: { caseId, policyVersionId: versionId } });
    expect(persisted).toHaveLength(1);
  });

  it('assessImpactForCase returns null for a case with no live policy binding', async () => {
    const jurisdictionCode = JURISDICTION_CODES[3];
    const versionId = await seedDraftVersion(
      jurisdictionCode,
      'pas-rule-percase-nobinding',
      '1.0.0',
      PolicyReleaseStatus.RELEASED,
    );
    const caseId = await makeCase(jurisdictionCode);

    const assessment = await impactService.assessImpactForCase(
      tenantId,
      caseId,
      versionId,
    );

    expect(assessment).toBeNull();
  });
});
