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
import { AgentRun } from '../database/entities/agent-run.entity';
import { AgentModelInvocation } from '../database/entities/agent-model-invocation.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import {
  AgentRunRouteStatus,
  ToolAttemptOutcome,
} from '../database/enums/agent-run.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the CaseCoreTenantIsolation,
// CaseConditionsAgentTenantIsolation, and AppRuntimeRole migrations
// applied: skip instead of failing when no DATABASE_URL is configured —
// same convention as this codebase's other real-DB specs.
//
// M5-004/M5-006's proof, mirroring webhook-tenant-isolation.spec.ts
// (M5-002): connects as the real `mortgage_app` role, not DATABASE_URL's
// own, for the exact same reason — a superuser connection would pass
// every one of these assertions trivially by bypassing RLS entirely,
// proving nothing.
//
// Covers the entire case-conditions core: `loan_cases`, `evidence_facts`,
// `outbox_events`, `condition_transitions` (M5-004), plus
// `loan_conditions`, `agent_runs`, `tool_attempts` (M5-006), and the
// content-free `agent_model_invocations` audit record (M7-035). Deliberately
// still out of scope: `case_policy_bindings`/`case_policy_snapshots`
// (`PolicyEvaluationService` has no `DataSource`/`EntityManager` at all
// today) and `provider_operation_intents`/`provider_authorization_grants`
// (several methods don't have `tenantId` in scope yet) — see the M5-006
// migration's own class comment.
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
  'case workflow and Agent audit tables enforce row-level security',
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
    let modelInvocationA: AgentModelInvocation;
    let modelInvocationB: AgentModelInvocation;
    let agentRunA: AgentRun;
    let agentRunB: AgentRun;
    let toolAttemptA: ToolAttempt;
    let toolAttemptB: ToolAttempt;

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
          AgentRun,
          AgentModelInvocation,
          ToolAttempt,
        ],
      });
      await adminDataSource.initialize();

      // Fixture setup for the *unprotected* tables this slice's tables
      // reference (tenants/jurisdictions have no RLS at all) goes through
      // the admin connection, same reasoning as
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
        // Tenant/Jurisdiction must be declared too, even though
        // mortgage_app is never queried against them directly here —
        // LoanCase's own ManyToOne relation targets must resolve during
        // metadata build, same reason webhook-tenant-isolation.spec.ts
        // (M5-002) had to declare OutboxEvent for WebhookDelivery's
        // relation.
        entities: [
          LoanCase,
          EvidenceFact,
          OutboxEvent,
          ConditionTransition,
          LoanCondition,
          AgentRun,
          AgentModelInvocation,
          ToolAttempt,
          Tenant,
          Jurisdiction,
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

      // loan_conditions now carries a real RLS policy (M5-006) — through
      // the restricted role, same as everything else above.
      function makeCondition(tenantId: string, caseId: string) {
        const repo = restrictedDataSource.getRepository(LoanCondition);
        return repo.create({
          tenantId,
          caseId,
          code: 'RLS_SPEC_CONDITION',
          description: `rls spec condition for ${tenantId}`,
          status: ConditionStatus.OPEN,
        });
      }
      loanConditionA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(LoanCondition)
            .save(makeCondition(tenantA, caseA.id)),
      );
      loanConditionB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(LoanCondition)
            .save(makeCondition(tenantB, caseB.id)),
      );

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

      function makeModelInvocation(tenantId: string, caseId: string) {
        const repo = restrictedDataSource.getRepository(AgentModelInvocation);
        return repo.create({
          tenantId,
          caseId,
          caseVersion: 1,
          workflowRunId: `rls-spec-run-${tenantId}`,
          modelVersion: 'rls-spec-model',
          promptVersion: 'rls-spec-prompt-v1',
          nextAction: 'EVALUATE_POLICY',
          reasonCode: 'POLICY_EVALUATION_REQUIRED',
          confidenceBasisPoints: 10_000,
          accountedTokenUnits: 128,
          requestDigest: 'a'.repeat(64),
          responseDigest: 'b'.repeat(64),
        });
      }
      modelInvocationA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(AgentModelInvocation)
            .save(makeModelInvocation(tenantA, caseA.id)),
      );
      modelInvocationB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(AgentModelInvocation)
            .save(makeModelInvocation(tenantB, caseB.id)),
      );

      // agent_runs/tool_attempts (M5-006) — tool_attempts has no
      // tenantId column of its own, same join-based-policy situation as
      // condition_transitions.
      function makeAgentRun(
        tenantId: string,
        caseId: string,
        modelInvocationId: string,
      ) {
        const repo = restrictedDataSource.getRepository(AgentRun);
        return repo.create({
          tenantId,
          caseId,
          workflowRunId: `rls-spec-run-${tenantId}`,
          route: AgentRunRouteStatus.PROPOSED_ACTION,
          modelInvocationId,
          modelVersion: 'rls-spec-model',
          promptVersion: 'rls-spec-prompt-v1',
          startedAt: new Date(),
        });
      }
      agentRunA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(AgentRun)
            .save(makeAgentRun(tenantA, caseA.id, modelInvocationA.id)),
      );
      agentRunB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(AgentRun)
            .save(makeAgentRun(tenantB, caseB.id, modelInvocationB.id)),
      );

      toolAttemptA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(ToolAttempt);
          return repo.save(
            repo.create({
              agentRunId: agentRunA.id,
              toolName: 'check_case_completeness',
              outcome: ToolAttemptOutcome.SUCCESS,
              attemptedAt: new Date(),
            }),
          );
        },
      );
      toolAttemptB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => {
          const repo = manager.getRepository(ToolAttempt);
          return repo.save(
            repo.create({
              agentRunId: agentRunB.id,
              toolName: 'check_case_completeness',
              outcome: ToolAttemptOutcome.SUCCESS,
              attemptedAt: new Date(),
            }),
          );
        },
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(ToolAttempt)
            .delete([toolAttemptA.id, toolAttemptB.id]);
          await manager
            .getRepository(AgentRun)
            .delete([agentRunA.id, agentRunB.id]);
          await manager
            .getRepository(AgentModelInvocation)
            .delete([modelInvocationA.id, modelInvocationB.id]);
          await manager
            .getRepository(ConditionTransition)
            .delete([conditionTransitionA.id, conditionTransitionB.id]);
          await manager
            .getRepository(LoanCondition)
            .delete([loanConditionA.id, loanConditionB.id]);
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
          .getRepository(Jurisdiction)
          .delete({ code: jurisdictionCode });
        await adminDataSource.getRepository(Tenant).delete([tenantA, tenantB]);
        await adminDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on any table, even though real rows exist', async () => {
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
      const conditions = await restrictedDataSource
        .getRepository(LoanCondition)
        .find();
      const agentRuns = await restrictedDataSource
        .getRepository(AgentRun)
        .find();
      const modelInvocations = await restrictedDataSource
        .getRepository(AgentModelInvocation)
        .find();
      const toolAttempts = await restrictedDataSource
        .getRepository(ToolAttempt)
        .find();

      expect(cases).toHaveLength(0);
      expect(evidence).toHaveLength(0);
      expect(outbox).toHaveLength(0);
      expect(transitions).toHaveLength(0);
      expect(conditions).toHaveLength(0);
      expect(agentRuns).toHaveLength(0);
      expect(modelInvocations).toHaveLength(0);
      expect(toolAttempts).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's rows everywhere", async () => {
      // Sequential, not Promise.all: these queries share one
      // transaction's single connection, and node-postgres itself warns
      // that overlapping (non-awaited-in-order) queries on one client is
      // deprecated and risks result-set confusion between them.
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
          conditions: await manager.getRepository(LoanCondition).find(),
          agentRuns: await manager.getRepository(AgentRun).find(),
          modelInvocations: await manager
            .getRepository(AgentModelInvocation)
            .find(),
        }),
      );

      expect(result.cases.map((c) => c.id)).toEqual([caseA.id]);
      expect(result.evidence.map((e) => e.id)).toEqual([evidenceFactA.id]);
      expect(result.outbox.map((e) => e.id)).toEqual([outboxEventA.id]);
      expect(result.conditions.map((c) => c.id)).toEqual([loanConditionA.id]);
      expect(result.agentRuns.map((r) => r.id)).toEqual([agentRunA.id]);
      expect(result.modelInvocations.map((i) => i.id)).toEqual([
        modelInvocationA.id,
      ]);
    });

    it("tenant B's context sees only tenant B's rows, never tenant A's", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
          conditions: await manager.getRepository(LoanCondition).find(),
          agentRuns: await manager.getRepository(AgentRun).find(),
          modelInvocations: await manager
            .getRepository(AgentModelInvocation)
            .find(),
        }),
      );

      expect(result.cases.map((c) => c.id)).toEqual([caseB.id]);
      expect(result.evidence).toHaveLength(0);
      expect(result.outbox).toHaveLength(0);
      expect(result.conditions.map((c) => c.id)).toEqual([loanConditionB.id]);
      expect(result.agentRuns.map((r) => r.id)).toEqual([agentRunB.id]);
      expect(result.modelInvocations.map((i) => i.id)).toEqual([
        modelInvocationB.id,
      ]);
    });

    it("a direct lookup by id for a different tenant's case or condition returns nothing, even though the row exists", async () => {
      const foundCase = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager.getRepository(LoanCase).findOneBy({ id: caseA.id }),
      );
      const foundCondition = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(LoanCondition)
            .findOneBy({ id: loanConditionA.id }),
      );

      expect(foundCase).toBeNull();
      expect(foundCondition).toBeNull();
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

    it("condition_transitions' and tool_attempts' join-based policies both isolate by tenant, even though neither table has a tenantId column of its own", async () => {
      const asTenantA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        async (manager) => ({
          transitions: await manager.getRepository(ConditionTransition).find(),
          toolAttempts: await manager.getRepository(ToolAttempt).find(),
        }),
      );
      const asTenantB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        async (manager) => ({
          transitions: await manager.getRepository(ConditionTransition).find(),
          toolAttempts: await manager.getRepository(ToolAttempt).find(),
        }),
      );

      expect(asTenantA.transitions.map((t) => t.id)).toEqual([
        conditionTransitionA.id,
      ]);
      expect(asTenantB.transitions.map((t) => t.id)).toEqual([
        conditionTransitionB.id,
      ]);
      expect(asTenantA.toolAttempts.map((t) => t.id)).toEqual([
        toolAttemptA.id,
      ]);
      expect(asTenantB.toolAttempts.map((t) => t.id)).toEqual([
        toolAttemptB.id,
      ]);
    });

    it("bypass mode sees every tenant's rows on every table at once — the one explicit, audited exception", async () => {
      const result = await runWithRlsBypass(
        restrictedDataSource,
        async (manager) => ({
          cases: await manager.getRepository(LoanCase).find(),
          evidence: await manager.getRepository(EvidenceFact).find(),
          outbox: await manager.getRepository(OutboxEvent).find(),
          transitions: await manager.getRepository(ConditionTransition).find(),
          conditions: await manager.getRepository(LoanCondition).find(),
          agentRuns: await manager.getRepository(AgentRun).find(),
          modelInvocations: await manager
            .getRepository(AgentModelInvocation)
            .find(),
          toolAttempts: await manager.getRepository(ToolAttempt).find(),
        }),
      );

      // Inclusion, not exact equality: bypass mode genuinely sees every
      // tenant's rows, so in a real shared scratch database (this same
      // one may already hold real rows from an earlier e2e-test run, for
      // example) it can legitimately return more than just this spec's
      // own fixtures. What actually matters is that bypass mode sees *at
      // least* this spec's own rows across every tenant at once — the
      // exact-equality checks above (tenant A's/tenant B's own context)
      // are what prove isolation; this proves the one audited exception
      // can still see across it.
      expect(result.cases.map((c) => c.id)).toEqual(
        expect.arrayContaining([caseA.id, caseB.id]),
      );
      expect(result.evidence.map((e) => e.id)).toEqual(
        expect.arrayContaining([evidenceFactA.id]),
      );
      expect(result.outbox.map((e) => e.id)).toEqual(
        expect.arrayContaining([outboxEventA.id]),
      );
      expect(result.transitions.map((t) => t.id)).toEqual(
        expect.arrayContaining([
          conditionTransitionA.id,
          conditionTransitionB.id,
        ]),
      );
      expect(result.conditions.map((c) => c.id)).toEqual(
        expect.arrayContaining([loanConditionA.id, loanConditionB.id]),
      );
      expect(result.agentRuns.map((r) => r.id)).toEqual(
        expect.arrayContaining([agentRunA.id, agentRunB.id]),
      );
      expect(result.modelInvocations.map((i) => i.id)).toEqual(
        expect.arrayContaining([modelInvocationA.id, modelInvocationB.id]),
      );
      expect(result.toolAttempts.map((t) => t.id)).toEqual(
        expect.arrayContaining([toolAttemptA.id, toolAttemptB.id]),
      );
    });
  },
);
