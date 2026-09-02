import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { PolicyResolutionStatus } from '../database/enums/policy-resolution-status.enum';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderCapabilityStatus } from '../database/enums/provider-platform.enum';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CaseQueryService } from './case-query.service';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured. Real, not mocked — evidence_facts/loan_conditions are both
// RLS-protected tables, and this is their first real query surface of any
// kind, so a real belt-and-suspenders proof (the WHERE clause AND RLS
// both independently enforce tenant scoping) is worth more here than a
// mocked repository would be.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('CaseQueryService (Section 15.2, M6)', () => {
  let dataSource: DataSource;
  let service: CaseQueryService;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        Jurisdiction,
        LoanCase,
        EvidenceFact,
        LoanCondition,
        CasePolicyBinding,
        CasePolicySnapshot,
        ProviderOperationIntent,
        AuditEvent,
      ],
    });
    await dataSource.initialize();
    service = new CaseQueryService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (tenantIds.length > 0) {
        await runInTenantContext(dataSource, tenantIds[0], (manager) =>
          manager.query('SELECT set_config($1, $2, true)', [
            'app.bypass_rls',
            'true',
          ]),
        );
        await dataSource
          .getRepository(EvidenceFact)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(LoanCondition)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(CasePolicyBinding)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(CasePolicySnapshot)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(ProviderOperationIntent)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        // audit_events is append-only by design (its own migration's
        // trigger rejects UPDATE/DELETE unconditionally, even under
        // app.bypass_rls) — no cleanup query here could remove this
        // spec's own fixture rows even if one were written; a fresh
        // scratch database per verification run is how this codebase's
        // own convention already handles that (audit-event.service.spec.ts
        // has the identical comment).
        await dataSource
          .getRepository(LoanCase)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource.getRepository(Tenant).delete(tenantIds);
      }
      await dataSource.destroy();
    }
  });

  async function makeCase(tenantId: string): Promise<string> {
    await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ id: tenantId, name: `case-query-spec-${tenantId}` }),
      );
    tenantIds.push(tenantId);
    const loanCase = await dataSource.getRepository(LoanCase).save(
      dataSource.getRepository(LoanCase).create({
        tenantId,
        idempotencyKey: `case-query-spec-${randomUUID()}`,
        borrowerId: 'case-query-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode: 'US-CA',
      }),
    );
    return loanCase.id;
  }

  it('listEvidenceFacts() returns only the requested case’s own evidence, ordered by observedAt', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(EvidenceFact);
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date('2026-01-02T00:00:00Z'),
      }),
    );
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        factType: EvidenceType.CREDIT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'credit-bureau-simulator',
        value: { score: 700 },
        observedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

    const facts = await service.listEvidenceFacts(tenantId, caseId);
    expect(facts).toHaveLength(2);
    expect(facts[0].factType).toBe(EvidenceType.CREDIT);
    expect(facts[1].factType).toBe(EvidenceType.INCOME);
  });

  it('listConditions() returns only the requested case’s own conditions', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(LoanCondition);
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        code: 'VERIFY_INCOME_DISCREPANCY',
        description: 'Income discrepancy exceeds threshold',
      }),
    );

    const conditions = await service.listConditions(tenantId, caseId);
    expect(conditions).toHaveLength(1);
    expect(conditions[0].code).toBe('VERIFY_INCOME_DISCREPANCY');
  });

  it('never returns another tenant’s evidence, even for the same caseId value reused across tenants', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const caseA = await makeCase(tenantA);
    await makeCase(tenantB);
    const repo = dataSource.getRepository(EvidenceFact);
    await repo.save(
      repo.create({
        tenantId: tenantA,
        caseId: caseA,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date(),
      }),
    );

    const factsForB = await service.listEvidenceFacts(tenantB, caseA);
    expect(factsForB).toHaveLength(0);
  });

  it('getActivePolicyBinding() returns only the currently-active (non-invalidated) binding', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const snapshotRepo = dataSource.getRepository(CasePolicySnapshot);
    const snapshot = await snapshotRepo.save(
      snapshotRepo.create({
        tenantId,
        caseId,
        contextHash: 'a'.repeat(64),
        resolverVersion: '1',
        resolutionStatus: PolicyResolutionStatus.RESOLVED,
        versions: [],
        unresolvedReasons: [],
      }),
    );
    const bindingRepo = dataSource.getRepository(CasePolicyBinding);
    const invalidated = await bindingRepo.save(
      bindingRepo.create({
        tenantId,
        caseId,
        dependencyDigest: 'b'.repeat(64),
        observedCatalogGeneration: 0,
        contextKey: 'US-CA|CONVENTIONAL|CASE_CREATED',
        policySnapshotId: snapshot.id,
        revalidateAfter: new Date(Date.now() + 60_000),
        invalidatedAt: new Date(),
      }),
    );
    const active = await bindingRepo.save(
      bindingRepo.create({
        tenantId,
        caseId,
        dependencyDigest: 'c'.repeat(64),
        observedCatalogGeneration: 1,
        contextKey: 'US-CA|CONVENTIONAL|CASE_CREATED',
        policySnapshotId: snapshot.id,
        revalidateAfter: new Date(Date.now() + 60_000),
      }),
    );

    const result = await service.getActivePolicyBinding(tenantId, caseId);
    expect(result?.id).toBe(active.id);
    expect(result?.id).not.toBe(invalidated.id);
  });

  it('getPolicySnapshot() reads a snapshot by id, tenant-scoped', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const snapshotRepo = dataSource.getRepository(CasePolicySnapshot);
    const snapshot = await snapshotRepo.save(
      snapshotRepo.create({
        tenantId,
        caseId,
        contextHash: 'd'.repeat(64),
        resolverVersion: '1',
        resolutionStatus: PolicyResolutionStatus.RESOLVED,
        versions: [],
        unresolvedReasons: [],
      }),
    );

    const result = await service.getPolicySnapshot(tenantId, snapshot.id);
    expect(result?.id).toBe(snapshot.id);

    const wrongTenant = await service.getPolicySnapshot(
      randomUUID(),
      snapshot.id,
    );
    expect(wrongTenant).toBeNull();
  });

  it('listProviderOperationIntents() returns only the requested case’s own intents', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(ProviderOperationIntent);
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        providerId: 'asset-verification-simulator',
        capability: ProviderCapabilityStatus.ASSET,
        effectClass: 'REUSABLE_LOOKUP',
        requestFingerprint: 'e'.repeat(64),
        idempotencyKey: randomUUID(),
        logicalOperationKey: randomUUID(),
        providerReceipt: null,
        normalizedFinding: null,
        authorizationGrantId: randomUUID(),
      }),
    );

    const intents = await service.listProviderOperationIntents(
      tenantId,
      caseId,
    );
    expect(intents).toHaveLength(1);
    expect(intents[0].providerId).toBe('asset-verification-simulator');
  });

  describe('listCases()', () => {
    async function setCaseFields(
      caseId: string,
      fields: Partial<Pick<LoanCase, 'borrowerId' | 'status' | 'createdAt'>>,
    ): Promise<void> {
      await dataSource.getRepository(LoanCase).update(caseId, fields);
    }

    it('returns the tenant’s own cases newest first, with a real hasNextPage/endCursor', async () => {
      const tenantId = randomUUID();
      const caseA = await makeCase(tenantId);
      const caseB = await makeCase(tenantId);
      const caseC = await makeCase(tenantId);
      await setCaseFields(caseA, {
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      await setCaseFields(caseB, {
        createdAt: new Date('2026-01-02T00:00:00Z'),
      });
      await setCaseFields(caseC, {
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });

      const page = await service.listCases(tenantId, { first: 2 });

      expect(page.edges.map((e) => e.node.id)).toEqual([caseC, caseB]);
      expect(page.pageInfo.hasNextPage).toBe(true);
      expect(page.pageInfo.endCursor).toBe(page.edges[1].cursor);
    });

    it('paginates via cursor with no gaps or duplicates across pages', async () => {
      const tenantId = randomUUID();
      const caseIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const caseId = await makeCase(tenantId);
        await setCaseFields(caseId, {
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        });
        caseIds.push(caseId);
      }

      const seen: string[] = [];
      let after: string | undefined;
      for (let i = 0; i < 3; i++) {
        const page = await service.listCases(tenantId, { first: 2, after });
        seen.push(...page.edges.map((e) => e.node.id));
        after = page.pageInfo.endCursor ?? undefined;
        if (!page.pageInfo.hasNextPage) {
          break;
        }
      }

      expect(seen).toEqual([...caseIds].reverse());
    });

    it('filters by status', async () => {
      const tenantId = randomUUID();
      const draftCase = await makeCase(tenantId);
      const reviewCase = await makeCase(tenantId);
      await setCaseFields(reviewCase, { status: CaseStatus.MANUAL_REVIEW });

      const page = await service.listCases(tenantId, {
        status: CaseStatus.MANUAL_REVIEW,
      });

      expect(page.edges).toHaveLength(1);
      expect(page.edges[0].node.id).toBe(reviewCase);
      void draftCase;
    });

    it('filters by borrowerId', async () => {
      const tenantId = randomUUID();
      const caseA = await makeCase(tenantId);
      await makeCase(tenantId);
      await setCaseFields(caseA, { borrowerId: 'unique-borrower-xyz' });

      const page = await service.listCases(tenantId, {
        borrowerId: 'unique-borrower-xyz',
      });

      expect(page.edges).toHaveLength(1);
      expect(page.edges[0].node.id).toBe(caseA);
    });

    it('never returns another tenant’s cases', async () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      await makeCase(tenantA);
      await makeCase(tenantB);

      const page = await service.listCases(tenantB);

      expect(page.edges).toHaveLength(1);
      expect(page.edges[0].node.tenantId).toBe(tenantB);
    });

    it('rejects a malformed "after" cursor', async () => {
      const tenantId = randomUUID();
      await makeCase(tenantId);

      await expect(
        service.listCases(tenantId, { after: 'not-a-real-cursor' }),
      ).rejects.toThrow(/Malformed "after" cursor/);
    });
  });

  describe('countCasesByStatus()', () => {
    async function setStatus(
      caseId: string,
      status: CaseStatus,
    ): Promise<void> {
      await dataSource.getRepository(LoanCase).update(caseId, { status });
    }

    it('groups the tenant’s own cases by status with a real count each', async () => {
      const tenantId = randomUUID();
      const draftA = await makeCase(tenantId);
      const draftB = await makeCase(tenantId);
      const reviewCase = await makeCase(tenantId);
      void draftA;
      void draftB;
      await setStatus(reviewCase, CaseStatus.MANUAL_REVIEW);

      const counts = await service.countCasesByStatus(tenantId);

      expect(counts).toEqual(
        expect.arrayContaining([
          { status: CaseStatus.DRAFT, count: 2 },
          { status: CaseStatus.MANUAL_REVIEW, count: 1 },
        ]),
      );
      expect(counts).toHaveLength(2);
    });

    it('omits a status with zero real cases entirely, rather than a fabricated zero row', async () => {
      const tenantId = randomUUID();
      await makeCase(tenantId);

      const counts = await service.countCasesByStatus(tenantId);

      expect(counts).toEqual([{ status: CaseStatus.DRAFT, count: 1 }]);
    });

    it('never counts another tenant’s cases', async () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      await makeCase(tenantA);
      await makeCase(tenantA);
      await makeCase(tenantB);

      const counts = await service.countCasesByStatus(tenantB);

      expect(counts).toEqual([{ status: CaseStatus.DRAFT, count: 1 }]);
    });
  });

  describe('listRecentActivity()', () => {
    it('returns the tenant’s own audit events across every case, newest first', async () => {
      const tenantId = randomUUID();
      const caseA = await makeCase(tenantId);
      const caseB = await makeCase(tenantId);
      await dataSource.getRepository(AuditEvent).save([
        {
          tenantId,
          actorId: 'reviewer-1',
          action: 'CASE_CREATED',
          resourceType: 'loan_case',
          resourceId: caseA,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          tenantId,
          actorId: 'reviewer-1',
          action: 'CASE_ESCALATED',
          resourceType: 'loan_case',
          resourceId: caseB,
          createdAt: new Date('2026-01-02T00:00:00Z'),
        },
      ]);

      const activity = await service.listRecentActivity(tenantId);

      expect(activity.map((e) => e.action)).toEqual([
        'CASE_ESCALATED',
        'CASE_CREATED',
      ]);
    });

    it('clamps an over-large limit to 100 and a sub-1 limit to 1', async () => {
      const tenantId = randomUUID();
      const caseId = await makeCase(tenantId);
      await dataSource.getRepository(AuditEvent).save({
        tenantId,
        actorId: 'reviewer-1',
        action: 'CASE_CREATED',
        resourceType: 'loan_case',
        resourceId: caseId,
      });

      const clampedLow = await service.listRecentActivity(tenantId, 0);
      expect(clampedLow).toHaveLength(1);

      const clampedHigh = await service.listRecentActivity(tenantId, 9999);
      expect(clampedHigh.length).toBeLessThanOrEqual(100);
    });

    it('never returns another tenant’s audit events', async () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const caseA = await makeCase(tenantA);
      await dataSource.getRepository(AuditEvent).save({
        tenantId: tenantA,
        actorId: 'reviewer-1',
        action: 'CASE_CREATED',
        resourceType: 'loan_case',
        resourceId: caseA,
      });

      const activity = await service.listRecentActivity(tenantB);

      expect(activity).toEqual([]);
    });
  });

  it('listAuditEvents() returns only events recorded with this exact caseId as their resourceId', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const otherCaseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(AuditEvent);
    await repo.save(
      repo.create({
        tenantId,
        actorId: 'case-query-spec-actor',
        action: 'CASE_ESCALATED',
        resourceType: 'loan_case',
        resourceId: caseId,
      }),
    );
    await repo.save(
      repo.create({
        tenantId,
        actorId: 'case-query-spec-actor',
        action: 'CASE_ESCALATED',
        resourceType: 'loan_case',
        resourceId: otherCaseId,
      }),
    );

    const events = await service.listAuditEvents(tenantId, caseId);
    expect(events).toHaveLength(1);
    expect(events[0].resourceId).toBe(caseId);
  });
});
