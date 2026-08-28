import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyChangeImpactKind } from '../database/enums/policy-change-impact.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the
// PolicyChangeImpactAssessmentTenantIsolation and AppRuntimeRole
// migrations applied: skip instead of failing when no DATABASE_URL is
// configured — same convention as every other real-DB spec in this
// codebase.
//
// M5-008's proof, same pattern as evaluation-manifest-tenant-isolation
// .spec.ts (M5-007): connects as the real `mortgage_app` role (M5-003),
// not DATABASE_URL's own, since a superuser connection would pass every
// one of these assertions trivially by bypassing RLS entirely.
// `policy_change_impact_assessments` has its own `tenantId` column
// directly (no join-based policy needed).
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const APP_ROLE = 'mortgage_app';
const APP_ROLE_PASSWORD =
  process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip('policy_change_impact_assessments row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const jurisdictionCode = `US-PCI-${randomUUID().slice(0, 8)}`;
  let policyVersionId: string;
  let sourceId: string;
  let revisionId: string;
  let assessmentA: PolicyChangeImpactAssessment;
  let assessmentB: PolicyChangeImpactAssessment;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      // The full PolicyVersion -> PolicySourceRevision -> PolicySource ->
      // Jurisdiction relation chain must be declared too, even though
      // none of it is queried directly here — every ManyToOne relation
      // target must resolve during metadata build, the same reason
      // webhook-tenant-isolation.spec.ts (M5-002) had to declare
      // OutboxEvent for WebhookDelivery's relation.
      entities: [
        PolicyChangeImpactAssessment,
        PolicyVersion,
        PolicySourceRevision,
        PolicySource,
        Jurisdiction,
      ],
    });
    await restrictedDataSource.initialize();

    // PolicyChangeImpactAssessment.policyVersionId carries a real FK to
    // policy_versions — none of this chain has RLS of its own, so which
    // connection creates it doesn't matter (the same "don't care why it
    // succeeds" reasoning M5-004's fixture setup used for tenants/
    // jurisdictions), it just has to exist for the FK to be satisfiable.
    await restrictedDataSource.getRepository(Jurisdiction).save(
      restrictedDataSource.getRepository(Jurisdiction).create({
        code: jurisdictionCode,
        level: JurisdictionLevel.STATE,
        name: 'Policy change impact RLS spec jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
    const source = await restrictedDataSource.getRepository(PolicySource).save(
      restrictedDataSource.getRepository(PolicySource).create({
        name: 'PCI RLS spec source',
        owner: 'policy-team',
        jurisdictionCode,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    sourceId = source.id;
    const revision = await restrictedDataSource
      .getRepository(PolicySourceRevision)
      .save(
        restrictedDataSource.getRepository(PolicySourceRevision).create({
          policySourceId: sourceId,
          checksum: 'sha256:pci-rls-spec',
          publishedAt: new Date('2025-01-01T00:00:00Z'),
          content: {},
        }),
      );
    revisionId = revision.id;
    const version = await restrictedDataSource
      .getRepository(PolicyVersion)
      .save(
        restrictedDataSource.getRepository(PolicyVersion).create({
          ruleId: 'pci-rls-spec-rule',
          version: '1.0.0',
          sourceRevisionId: revisionId,
          dsl: {},
          effectiveFrom: new Date('2025-01-01T00:00:00Z'),
          effectiveTo: null,
          releaseStatus: PolicyReleaseStatus.RELEASED,
        }),
      );
    policyVersionId = version.id;

    function makeAssessment(tenantId: string) {
      const repo = restrictedDataSource.getRepository(
        PolicyChangeImpactAssessment,
      );
      return repo.create({
        policyVersionId,
        tenantId,
        caseId: randomUUID(),
        priorPolicyBindingId: null,
        impact: PolicyChangeImpactKind.NO_IMPACT,
        details: 'rls spec assessment',
      });
    }

    assessmentA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager
          .getRepository(PolicyChangeImpactAssessment)
          .save(makeAssessment(tenantA)),
    );
    assessmentB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(PolicyChangeImpactAssessment)
          .save(makeAssessment(tenantB)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager
          .getRepository(PolicyChangeImpactAssessment)
          .delete([assessmentA.id, assessmentB.id]),
      );
      await restrictedDataSource
        .getRepository(PolicyVersion)
        .delete({ id: policyVersionId });
      await restrictedDataSource
        .getRepository(PolicySourceRevision)
        .delete({ id: revisionId });
      await restrictedDataSource
        .getRepository(PolicySource)
        .delete({ id: sourceId });
      await restrictedDataSource
        .getRepository(Jurisdiction)
        .delete({ code: jurisdictionCode });
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const assessments = await restrictedDataSource
      .getRepository(PolicyChangeImpactAssessment)
      .find();
    expect(assessments).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's assessment", async () => {
    const assessments = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(PolicyChangeImpactAssessment).find(),
    );
    expect(assessments.map((a) => a.id)).toEqual([assessmentA.id]);
  });

  it("tenant B's context sees only tenant B's assessment, never tenant A's", async () => {
    const assessments = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(PolicyChangeImpactAssessment).find(),
    );
    expect(assessments.map((a) => a.id)).toEqual([assessmentB.id]);
  });

  it("a direct lookup by id for a different tenant's assessment returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(PolicyChangeImpactAssessment)
          .findOneBy({ id: assessmentA.id }),
    );
    expect(found).toBeNull();
  });

  it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(PolicyChangeImpactAssessment);
        return repo.save(
          repo.create({
            policyVersionId,
            // Row claims tenant A while the session context says tenant B.
            tenantId: tenantA,
            caseId: randomUUID(),
            priorPolicyBindingId: null,
            impact: PolicyChangeImpactKind.NO_IMPACT,
            details: 'spoofed insert',
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's assessments at once — the one explicit, audited exception", async () => {
    const assessments = await runWithRlsBypass(
      restrictedDataSource,
      (manager) => manager.getRepository(PolicyChangeImpactAssessment).find(),
    );
    const ids = assessments.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([assessmentA.id, assessmentB.id]),
    );
  });
});
