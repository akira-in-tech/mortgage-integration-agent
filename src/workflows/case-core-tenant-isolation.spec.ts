import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the CaseCoreTenantIsolation and
// AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as this codebase's other
// real-DB specs.
//
// M5-004's proof, mirroring webhook-tenant-isolation.spec.ts (M5-002):
// connects as the real `mortgage_app` role, not DATABASE_URL's own, for
// the exact same reason — a superuser connection would pass every one of
// these assertions trivially by bypassing RLS entirely, proving nothing.
//
// Covers `loan_cases`, `evidence_facts`, `outbox_events`, and
// `condition_transitions` — the case-conditions core tables in scope for
// M5-004 (see that migration's own class comment for what's deliberately
// out of scope: `loan_conditions` itself, `agent_runs`/`tool_attempts`,
// the policy-engine and provider-platform tables).
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

describeOrSkip(
  'loan_cases/evidence_facts/outbox_events/condition_transitions row-level security',
  () => {
    let adminDataSource: DataSource;
    let restrictedDataSource: DataSource;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const jurisdictionCode = `US-RLS-${randomUUID().slice(0, 8)}`;
    let caseA: LoanCase;
    let caseB: LoanCase;
    let evidenceFactA: EvidenceFact;
    let outboxEventA: OutboxEvent;
    let loanConditionA: LoanCondition;
    let loanConditionB: LoanCondition;
    let conditionTransitionA: ConditionTransition;
    let conditionTransitionB: ConditionTransition;

    beforeAll(async () => {
      adminDataSource = new DataSource({
        type: 'postgres',
        url: DATABASE_URL,
        entities: [
          Tenant,
          Jurisdiction,
          LoanCase,
          EvidenceFact,
          OutboxEvent,
          LoanCondition,
          ConditionTransition,
        ],
      });
      await adminDataSource.initialize();

      // Fixture setup for the *unprotected* tables this slice's tables
      // reference (tenants/jurisdictions have no RLS at all; loan_conditions
      // deliberately has none this slice — see the migration's own
      // comment) goes through the admin connection, same reasoning as
      // webhook-tenant-isolation.spec.ts's outbox_events fixture setup in
      // M5-002: we don't care *why* these inserts succeed, only that the
      // rows exist for the real, in-scope tables to reference.
      const tenantRepo = adminDataSource.getRepository(Tenant);
      await tenantRepo.save([
        tenantRepo.create({ id: tenantA, name: 'Case-core RLS spec tenant A' }),
        tenantRepo.create({ id: tenantB, name: 'Case-core RLS spec tenant B' }),
      ]);
      await adminDataSource.getRepository(Jurisdiction).save(
        adminDataSource.getRepository(Jurisdiction).create({
          code: jurisdictionCode,
          level: JurisdictionLevel.STATE,
          name: 'Case-core RLS spec jurisdiction',
          coverageStatus: JurisdictionCoverageStatus.COVERED,
        }),
      );

      restrictedDataSource = new DataSource({
        type: 'postgres',
        url: withCredentials(
          DATABASE_URL as string,
          APP_ROLE,
          APP_ROLE_PASSWORD,
        ),
        // Tenant/Jurisdiction/LoanCondition must be declared too, even
        // though mortgage_app is never queried against Tenant/
        // Jurisdiction directly here and loan_conditions has no RLS
        // policy this slice — LoanCase's/ConditionTransition's own
        // ManyToOne relation targets must resolve during metadata build,
        // same reason webhook-tenant-isolation.spec.ts (M5-002) had to
        // declare OutboxEvent for WebhookDelivery's relation.
        entities: [
          LoanCase,
          EvidenceFact,
          OutboxEvent,
          ConditionTransition,
          Tenant,
          Jurisdiction,
          LoanCondition,
        ],
      });
      await restrictedDataSource.initialize();

      function makeCase(tenantId: string) {
        const repo = restrictedDataSource.getRepository(LoanCase);
        return repo.create({
          tenantId,
          idempotencyKey: `rls-spec-${tenantId}`,
          borrowerId: 'rls-spec-borrower',
          requestedAmount: 300_000,
          loanType: LoanType.CONVENTIONAL,
          statedMonthlyIncome: 9000,
          jurisdictionCode,
          status: CaseStatus.DRAFT,
        });
      }

      caseA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => manager.getRepository(LoanCase).save(makeCase(tenantA)),
      );
      caseB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(LoanCase).save(makeCase(tenantB)),
      );

      evidenceFactA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(EvidenceFact);
          return repo.save(
            repo.create({
              tenantId: tenantA,
              caseId: caseA.id,
              factType: EvidenceType.INCOME,
              sourceKind: EvidenceSourceKind.SIMULATOR,
              sourceIdentifier: 'rls-spec',
              value: { monthlyIncome: 9000 },
              observedAt: new Date(),
            }),
          );
        },
      );

      outboxEventA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(OutboxEvent);
          return repo.save(
            repo.create({
              tenantId: tenantA,
              caseId: caseA.id,
              eventType: 'loan_case.created',
              payload: { caseId: caseA.id },
              signature: 'rls-spec-signature',
            }),
          );
        },
      );

      // loan_conditions has no RLS policy this slice — admin connection,
      // real tenantId data, same "don't care why it succeeds" reasoning.
      const conditionRepo = adminDataSource.getRepository(LoanCondition);
      [loanConditionA, loanConditionB] = await conditionRepo.save([
        conditionRepo.create({
          tenantId: tenantA,
          caseId: caseA.id,
          code: 'RLS_SPEC_CONDITION',
          description: 'rls spec condition A',
          status: ConditionStatus.OPEN,
        }),
        conditionRepo.create({
          tenantId: tenantB,
          caseId: caseB.id,
          code: 'RLS_SPEC_CONDITION',
          description: 'rls spec condition B',
          status: ConditionStatus.OPEN,
        }),
      ]);

      conditionTransitionA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(ConditionTransition);
          return repo.save(
            repo.create({
              conditionId: loanConditionA.id,
              fromStatus: ConditionStatus.OPEN,
              toStatus: ConditionStatus.SATISFIED,
              actorId: 'rls-spec-actor',
              reason: 'rls spec transition A',
            }),
          );
        },
      );
      conditionTransitionB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => {
          const repo = manager.getRepository(ConditionTransition);
          return repo.save(
            repo.create({
              conditionId: loanConditionB.id,
              fromStatus: ConditionStatus.OPEN,
              toStatus: ConditionStatus.SATISFIED,
              actorId: 'rls-spec-actor',
              reason: 'rls spec transition B',
            }),
          );
        },
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(ConditionTransition)
            .delete([conditionTransitionA.id, conditionTransitionB.id]);
          await manager
            .getRepository(OutboxEvent)
            .delete({ id: outboxEventA.id });
          await manager
            .getRepository(EvidenceFact)
            .delete({ id: evidenceFactA.id });
          await manager.getRepository(LoanCase).delete([caseA.id, caseB.id]);
        });
        await restrictedDataSource.destroy();
      }
      if (adminDataSource?.isInitialized) {
        await adminDataSource
          .getRepository(LoanCondition)
          .delete([loanConditionA.id, loanConditionB.id]);
        await adminDataSource
          .getRepository(Jurisdiction)
          .delete({ code: jurisdictionCode });
        await adminDataSource.getRepository(Tenant).delete([tenantA, tenantB]);
        await adminDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on all four tables, even though real rows exist', async () => {
      const cases = await restrictedDataSource.getRepository(LoanCase).find();
      const evidence = await restrictedDataSource
        .getRepository(EvidenceFact)
        .find();
      const outbox = await restrictedDataSource
        .getRepository(OutboxEvent)
        .find();
      const transitions = await restrictedDataSource
        .getRepository(ConditionTransition)
        .find();

      expect(cases).toHaveLength(0);
      expect(evidence).toHaveLength(0);
      expect(outbox).toHaveLength(0);
      expect(transitions).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's rows on loan_cases/evidence_facts/outbox_events", async () => {
      // Sequential, not Promise.all: these three queries share one
      // transaction's single connection, and node-postgres itself warns
      // that overlapping (non-awaited-in-order) queries on one client is
      // deprecated and risks result-set confusion between them.
      const { cases, evidence, outbox } = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
        }),
      );

      expect(cases.map((c) => c.id)).toEqual([caseA.id]);
      expect(evidence.map((e) => e.id)).toEqual([evidenceFactA.id]);
      expect(outbox.map((e) => e.id)).toEqual([outboxEventA.id]);
    });

    it("tenant B's context sees only tenant B's case, never tenant A's — including tenant A's evidence/outbox rows", async () => {
      const { cases, evidence, outbox } = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
        }),
      );

      expect(cases.map((c) => c.id)).toEqual([caseB.id]);
      expect(evidence).toHaveLength(0);
      expect(outbox).toHaveLength(0);
    });

    it("a direct lookup by id for a different tenant's case returns nothing, even though the row exists", async () => {
      const found = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager.getRepository(LoanCase).findOneBy({ id: caseA.id }),
      );

      expect(found).toBeNull();
    });

    it("an UPDATE against a different tenant's case affects zero rows rather than erroring or succeeding silently", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(LoanCase)
            .update({ id: caseA.id }, { borrowerId: 'attacker-controlled' }),
      );
      expect(result.affected).toBe(0);

      const stillIntact = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager.getRepository(LoanCase).findOneByOrFail({ id: caseA.id }),
      );
      expect(stillIntact.borrowerId).toBe('rls-spec-borrower');
    });

    it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
      await expect(
        runInTenantContext(restrictedDataSource, tenantB, (manager) => {
          const repo = manager.getRepository(LoanCase);
          return repo.save(
            repo.create({
              // Row claims tenant A while the session context says tenant B.
              tenantId: tenantA,
              idempotencyKey: 'rls-spec-spoofed',
              borrowerId: 'rls-spec-borrower',
              requestedAmount: 300_000,
              loanType: LoanType.CONVENTIONAL,
              statedMonthlyIncome: 9000,
              jurisdictionCode,
              status: CaseStatus.DRAFT,
            }),
          );
        }),
      ).rejects.toThrow();
    });

    it("condition_transitions' join-based policy isolates by tenant even though the table has no tenantId column of its own", async () => {
      const asTenantA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => manager.getRepository(ConditionTransition).find(),
      );
      const asTenantB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(ConditionTransition).find(),
      );

      expect(asTenantA.map((t) => t.id)).toEqual([conditionTransitionA.id]);
      expect(asTenantB.map((t) => t.id)).toEqual([conditionTransitionB.id]);
    });

    it("bypass mode sees every tenant's rows on all four tables at once — the one explicit, audited exception", async () => {
      const { cases, evidence, outbox, transitions } = await runWithRlsBypass(
        restrictedDataSource,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
          transitions: await manager.getRepository(ConditionTransition).find(),
        }),
      );

      // Inclusion, not exact equality: bypass mode genuinely sees every
      // tenant's rows, so in a real shared scratch database (this same
      // one may already hold real outbox_events rows from an earlier
      // e2e-test run, for example) it can legitimately return more than
      // just this spec's own fixtures. What actually matters is that
      // bypass mode sees *at least* this spec's own rows across every
      // tenant at once — the exact-equality checks above (tenant A's/
      // tenant B's own context) are what prove isolation; this proves
      // the one audited exception can still see across it.
      const caseIds = cases.map((c) => c.id);
      const evidenceIds = evidence.map((e) => e.id);
      const outboxIds = outbox.map((e) => e.id);
      const transitionIds = transitions.map((t) => t.id);
      expect(caseIds).toEqual(expect.arrayContaining([caseA.id, caseB.id]));
      expect(evidenceIds).toEqual(expect.arrayContaining([evidenceFactA.id]));
      expect(outboxIds).toEqual(expect.arrayContaining([outboxEventA.id]));
      expect(transitionIds).toEqual(
        expect.arrayContaining([
          conditionTransitionA.id,
          conditionTransitionB.id,
        ]),
      );
    });
  },
);
