import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import { Jurisdiction } from '../../database/entities/jurisdiction.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../../database/entities/loan-condition.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../../database/entities/evidence-fact.entity';
import { PolicySource } from '../../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../../database/entities/policy-version.entity';
import { PolicyApplicability } from '../../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../../database/entities/policy-catalog-generation.entity';
import { EvaluationInputManifest } from '../../database/entities/evaluation-input-manifest.entity';
import { AgentRun } from '../../database/entities/agent-run.entity';
import { ToolAttempt } from '../../database/entities/tool-attempt.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../../database/enums/policy-version.enum';
import { LoanType } from '../../database/enums/loan-type.enum';
import { PolicyApplicabilityResolverService } from '../../policy/policy-applicability-resolver.service';
import { PolicyEvaluationService } from '../../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../../policy/evaluation-manifest.service';
import { LendingOperationsAgentState } from '../agent-state.types';
import { AgentRunInput } from '../agent-runtime.types';
import { createLendingOperationsAgentRuntime } from './lending-operations-agent-runtime';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const TENANT_NAME = 'LangGraph Runtime Spec Tenant';
const JURISDICTION_CODE = 'US-LGR-TEST';
const NOT_COVERED_JURISDICTION_CODE = 'US-LGR-NC';
const PRODUCT_CODE = 'CONVENTIONAL_MORTGAGE';
const LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';
const OUTBOX_SIGNING_SECRET = 'langgraph-runtime-spec-secret-32-char';
const ALL_TOOLS = [
  'check_case_completeness',
  'evaluate_policy',
  'create_condition',
];

describeOrSkip(
  'createLendingOperationsAgentRuntime (real LangGraph.js v1 graph)',
  () => {
    let dataSource: DataSource;
    let policyEvaluationService: PolicyEvaluationService;
    let evaluationManifestService: EvaluationManifestService;
    let runtime: ReturnType<typeof createLendingOperationsAgentRuntime>;
    let tenantId: string;
    const caseIds: string[] = [];

    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'postgres',
        url: DATABASE_URL,
        entities: [
          Tenant,
          LoanCase,
          Jurisdiction,
          LoanCondition,
          OutboxEvent,
          EvidenceFact,
          PolicySource,
          PolicySourceRevision,
          PolicyVersion,
          PolicyApplicability,
          CasePolicySnapshot,
          CasePolicyBinding,
          PolicyCatalogGeneration,
          EvaluationInputManifest,
          AgentRun,
          ToolAttempt,
        ],
      });
      await dataSource.initialize();

      const resolver = new PolicyApplicabilityResolverService(
        dataSource.getRepository(Jurisdiction),
        dataSource.getRepository(PolicyApplicability),
        dataSource.getRepository(PolicyVersion),
      );
      policyEvaluationService = new PolicyEvaluationService(
        resolver,
        dataSource,
        dataSource.getRepository(PolicyCatalogGeneration),
      );
      evaluationManifestService = new EvaluationManifestService(dataSource);
      runtime = createLendingOperationsAgentRuntime({
        dataSource,
        policyEvaluationService,
        evaluationManifestService,
        outboxSigningSecret: OUTBOX_SIGNING_SECRET,
      });

      const tenant = await dataSource
        .getRepository(Tenant)
        .save(dataSource.getRepository(Tenant).create({ name: TENANT_NAME }));
      tenantId = tenant.id;

      await dataSource.getRepository(Jurisdiction).save([
        dataSource.getRepository(Jurisdiction).create({
          code: JURISDICTION_CODE,
          level: JurisdictionLevel.STATE,
          name: 'LangGraph runtime spec (covered)',
          coverageStatus: JurisdictionCoverageStatus.COVERED,
        }),
        dataSource.getRepository(Jurisdiction).create({
          code: NOT_COVERED_JURISDICTION_CODE,
          level: JurisdictionLevel.STATE,
          name: 'LangGraph runtime spec (not covered)',
          coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
        }),
      ]);

      const sourceRepo = dataSource.getRepository(PolicySource);
      const source = await sourceRepo.save(
        sourceRepo.create({
          name: 'LangGraph runtime spec source',
          owner: 'policy-team',
          jurisdictionCode: JURISDICTION_CODE,
          retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
          freshnessObjectiveHours: 24,
        }),
      );
      const revisionRepo = dataSource.getRepository(PolicySourceRevision);
      const revision = await revisionRepo.save(
        revisionRepo.create({
          policySourceId: source.id,
          checksum: 'sha256:langgraph-runtime-spec',
          publishedAt: new Date('2025-01-01T00:00:00Z'),
          content: {},
        }),
      );
      const versionRepo = dataSource.getRepository(PolicyVersion);
      const version = await versionRepo.save(
        versionRepo.create({
          ruleId: 'langgraph-runtime-spec-income-discrepancy',
          version: '1.0.0',
          sourceRevisionId: revision.id,
          dsl: {
            rule: {
              id: 'langgraph-runtime-spec-income-discrepancy',
              version: '1.0.0',
              applicability: {
                jurisdictions: [JURISDICTION_CODE],
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
          },
          effectiveFrom: new Date('2025-01-01T00:00:00Z'),
          releaseStatus: PolicyReleaseStatus.RELEASED,
        }),
      );
      const applicabilityRepo = dataSource.getRepository(PolicyApplicability);
      await applicabilityRepo.save(
        applicabilityRepo.create({
          policyVersionId: version.id,
          jurisdictionCode: JURISDICTION_CODE,
          productCode: PRODUCT_CODE,
          lifecycleEvent: LIFECYCLE_EVENT,
        }),
      );
    }, 30_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        // ToolAttempt cascades on AgentRun's delete.
        await dataSource.getRepository(AgentRun).delete({ tenantId });
        await dataSource
          .getRepository(EvaluationInputManifest)
          .delete({ tenantId });
        await dataSource.getRepository(OutboxEvent).delete({ tenantId });
        await dataSource.getRepository(CasePolicyBinding).delete({ tenantId });
        await dataSource.getRepository(CasePolicySnapshot).delete({ tenantId });
        if (caseIds.length) {
          await dataSource.getRepository(EvidenceFact).delete({ tenantId });
          const conditions = await dataSource
            .getRepository(LoanCondition)
            .find({ where: caseIds.map((caseId) => ({ caseId })) });
          if (conditions.length) {
            await dataSource
              .getRepository(LoanCondition)
              .delete(conditions.map((c) => ({ id: c.id })));
          }
          await dataSource.getRepository(LoanCase).delete(caseIds);
        }
        await dataSource.getRepository(Tenant).delete({ id: tenantId });
        await dataSource.getRepository(PolicyApplicability).delete({
          jurisdictionCode: JURISDICTION_CODE,
        });
        await dataSource
          .getRepository(PolicyVersion)
          .delete({ ruleId: 'langgraph-runtime-spec-income-discrepancy' });
        await dataSource
          .getRepository(PolicySourceRevision)
          .delete({ checksum: 'sha256:langgraph-runtime-spec' });
        await dataSource
          .getRepository(PolicySource)
          .delete({ name: 'LangGraph runtime spec source' });
        await dataSource
          .getRepository(Jurisdiction)
          .delete({ code: JURISDICTION_CODE });
        await dataSource
          .getRepository(Jurisdiction)
          .delete({ code: NOT_COVERED_JURISDICTION_CODE });
        await dataSource.destroy();
      }
    }, 30_000);

    async function makeCase(
      overrides: Partial<{
        statedMonthlyIncome: number;
        jurisdictionCode: string;
        loanType: LoanType;
      }> = {},
    ): Promise<string> {
      const caseRepo = dataSource.getRepository(LoanCase);
      const loanCase = await caseRepo.save(
        caseRepo.create({
          tenantId,
          idempotencyKey: `lgr-spec-${Date.now()}-${Math.random()}`,
          borrowerId: 'lgr-spec-borrower',
          requestedAmount: 300_000,
          loanType: overrides.loanType ?? LoanType.CONVENTIONAL,
          statedMonthlyIncome: overrides.statedMonthlyIncome ?? 9000,
          jurisdictionCode: overrides.jurisdictionCode ?? JURISDICTION_CODE,
          status: CaseStatus.COLLECTING_EVIDENCE,
        }),
      );
      caseIds.push(loanCase.id);
      return loanCase.id;
    }

    async function addEvidence(
      caseId: string,
      factType: EvidenceType,
      value: Record<string, unknown>,
    ): Promise<void> {
      const evidenceRepo = dataSource.getRepository(EvidenceFact);
      await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId,
          factType,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'test-simulator',
          value,
          observedAt: new Date(),
        }),
      );
    }

    function makeInitialState(
      caseId: string,
      overrides: Partial<LendingOperationsAgentState> = {},
    ): LendingOperationsAgentState {
      const now = new Date();
      return {
        tenantId,
        caseId,
        caseVersion: 1,
        workflowRunId: 'lgr-spec-run',
        workflowStatus: 'RUNNING',
        consentStatus: 'VALID',
        evidenceSummary: [],
        openConditions: [],
        providerHealth: [],
        attemptedTools: [],
        remainingStepBudget: 10,
        remainingDurationBudgetMs: 60_000,
        remainingTokenBudget: 10_000,
        remainingProviderCallBudget: 10,
        budgetCurrency: 'USD',
        remainingCostBudgetMinorUnits: 10_000,
        budgetLedgerVersion: 1,
        runStartedAt: now.toISOString(),
        runDeadlineAt: new Date(now.getTime() + 60_000).toISOString(),
        ...overrides,
      };
    }

    function makeInput(
      state: LendingOperationsAgentState,
      overrides: Partial<AgentRunInput> = {},
    ): AgentRunInput {
      return {
        initialState: state,
        allowedTools: ALL_TOOLS,
        budget: {
          stepBudget: state.remainingStepBudget,
          durationBudgetMs: state.remainingDurationBudgetMs,
          tokenBudget: state.remainingTokenBudget,
          providerCallBudget: state.remainingProviderCallBudget,
          costBudgetMinorUnits: state.remainingCostBudgetMinorUnits,
          currency: state.budgetCurrency,
        },
        runDeadlineAt: state.runDeadlineAt,
        ...overrides,
      };
    }

    it('routes to AWAITING_INFORMATION when required evidence is missing', async () => {
      const caseId = await makeCase();
      await addEvidence(caseId, EvidenceType.CREDIT, {});

      const result = await runtime.run(makeInput(makeInitialState(caseId)));

      expect(result.route).toBe('AWAITING_INFORMATION');
      expect(result.finalState.attemptedTools.map((t) => t.toolName)).toEqual([
        'check_case_completeness',
      ]);
    });

    it('proposes no action and creates no condition when income matches evidence', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(makeInput(makeInitialState(caseId)));

      expect(result.route).toBe('PROPOSED_ACTION');
      expect(result.finalState.proposedAction).toBeUndefined();
      const conditions = await dataSource
        .getRepository(LoanCondition)
        .find({ where: { caseId } });
      expect(conditions).toHaveLength(0);

      // M3-022 (Section 20's exit evidence F): a completed DSL evaluation
      // that finds nothing applicable still gets a real, evidence-backed
      // manifest — not only evaluations that go on to open a condition.
      const manifests = await dataSource
        .getRepository(EvaluationInputManifest)
        .find({ where: { caseId } });
      expect(manifests).toHaveLength(1);
      expect(manifests[0].policyBindingId).not.toBeNull();
      expect(manifests[0].evidenceRefs).toHaveLength(1);
    });

    it('assembles a manifest with no evidence when no policy version is even applicable to the case (M3-022)', async () => {
      // FHA_MORTGAGE has no seeded applicability row in this fixture set
      // (only CONVENTIONAL_MORTGAGE does) — a real, resolved "nothing
      // applies here" outcome, distinct from an unresolved ambiguity.
      const caseId = await makeCase({ loanType: LoanType.FHA });
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(makeInput(makeInitialState(caseId)));

      expect(result.route).toBe('PROPOSED_ACTION');
      const conditions = await dataSource
        .getRepository(LoanCondition)
        .find({ where: { caseId } });
      expect(conditions).toHaveLength(0);

      const manifests = await dataSource
        .getRepository(EvaluationInputManifest)
        .find({ where: { caseId } });
      expect(manifests).toHaveLength(1);
      expect(manifests[0].policyBindingId).not.toBeNull();
      expect(manifests[0].evidenceRefs).toEqual([]);
    });

    it('proposes and executes create_condition when income diverges from evidence, populating policySnapshotId', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 25_000 });
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 20_000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(makeInput(makeInitialState(caseId)));

      expect(result.route).toBe('PROPOSED_ACTION');
      expect(result.finalState.proposedAction?.tool).toBe('create_condition');
      const conditionId = result.finalState.proposedAction?.arguments
        .conditionId as string;
      const condition = await dataSource
        .getRepository(LoanCondition)
        .findOneByOrFail({ id: conditionId });
      expect(condition.status).toBe(ConditionStatus.OPEN);
      expect(condition.code).toBe('VERIFY_INCOME_DISCREPANCY');
      expect(condition.policySnapshotId).not.toBeNull();

      // M3-014: the evaluation that justified this condition is now a
      // real, evidence-backed, immutable manifest — not just the CAS
      // check on LoanCase.version.
      expect(condition.evaluationManifestId).not.toBeNull();
      const manifest = await dataSource
        .getRepository(EvaluationInputManifest)
        .findOneByOrFail({ id: condition.evaluationManifestId! });
      expect(manifest.caseId).toBe(caseId);
      expect(manifest.policyBindingId).not.toBeNull();
      expect(manifest.observedPolicyDependencyDigest).toHaveLength(64);
      expect(manifest.evaluatorVersion).toBe('1.0.0');
      expect(manifest.manifestHash).toHaveLength(64);
      const incomeFact = await dataSource
        .getRepository(EvidenceFact)
        .findOneByOrFail({ caseId, factType: EvidenceType.INCOME });
      expect(manifest.evidenceRefs).toEqual([
        expect.objectContaining({
          evidenceId: incomeFact.id,
          version: incomeFact.version,
        }),
      ]);
      // No backing subsystem yet — honestly empty/null, not fabricated
      // (see the entity's own comment).
      expect(manifest.authorizationDecisionId).toBeNull();
      expect(manifest.consentVersionRefs).toEqual([]);
      expect(manifest.calculationRefs).toEqual([]);
      expect(manifest.modelAndPromptManifestId).toBeNull();

      const updatedCase = await dataSource
        .getRepository(LoanCase)
        .findOneByOrFail({ id: caseId });
      expect(updatedCase.status).toBe(CaseStatus.CONDITIONS_OPEN);

      // M3-013: the run's own history is now durable, not just returned
      // in memory.
      const agentRuns = await dataSource
        .getRepository(AgentRun)
        .find({ where: { caseId } });
      expect(agentRuns).toHaveLength(1);
      expect(agentRuns[0]).toMatchObject({
        route: 'PROPOSED_ACTION',
        proposedActionTool: 'create_condition',
      });
      const toolAttempts = await dataSource.getRepository(ToolAttempt).find({
        where: { agentRunId: agentRuns[0].id },
        order: { attemptedAt: 'ASC' },
      });
      expect(toolAttempts.map((a) => a.toolName)).toEqual([
        'check_case_completeness',
        'evaluate_policy',
        'create_condition',
      ]);
      expect(toolAttempts.every((a) => a.outcome === 'SUCCESS')).toBe(true);
    });

    it('propagates a stale-version failure instead of creating a condition when the case has moved on since the run began', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 25_000 });
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 20_000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});
      // A fresh case's version is 1 (VersionColumn) — passing a
      // mismatched caseVersion here simulates the case having been
      // mutated concurrently since this run's initial state was captured,
      // without needing real concurrent execution to trigger it.
      const state = makeInitialState(caseId, { caseVersion: 2 });

      await expect(runtime.run(makeInput(state))).rejects.toThrow(
        /version changed/,
      );

      const conditions = await dataSource
        .getRepository(LoanCondition)
        .find({ where: { caseId } });
      expect(conditions).toHaveLength(0);
    });

    it('interrupts for review (does not route to manual review) when the case jurisdiction has no policy coverage', async () => {
      // Section 9.5: "ambiguity... interrupt for review" — unresolved
      // policy applicability is an ambiguity a reviewer can fix (activate
      // coverage, resolve an overlapping version) and signal resumption
      // from, distinct from a runtime failure that routes to manual
      // review outright.
      const caseId = await makeCase({
        jurisdictionCode: NOT_COVERED_JURISDICTION_CODE,
      });
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(makeInput(makeInitialState(caseId)));

      expect(result.route).toBe('INTERRUPTED_FOR_REVIEW');
      expect(result.finalState.reviewState?.requested).toBe(true);
      expect(result.finalState.reviewState?.reason).toContain(
        NOT_COVERED_JURISDICTION_CODE,
      );
      // M3-021: the unified mandatory-review classification (Section 20's
      // exit evidence B) tags this as POLICY_AMBIGUITY, and that's what
      // real persisted AgentRun row carries too, not just the free-text
      // reason.
      expect(result.finalState.reviewState?.category).toBe('POLICY_AMBIGUITY');
      const persistedRun = await dataSource
        .getRepository(AgentRun)
        .findOneByOrFail({ caseId });
      expect(persistedRun.reviewCategory).toBe('POLICY_AMBIGUITY');
    });

    it('fails closed to ROUTED_TO_MANUAL_REVIEW when a required tool is not in allowedTools', async () => {
      const caseId = await makeCase();
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(
        makeInput(makeInitialState(caseId), {
          allowedTools: ['evaluate_policy'],
        }),
      );

      expect(result.route).toBe('ROUTED_TO_MANUAL_REVIEW');
      expect(result.finalState.reviewState?.reason).toContain(
        'check_case_completeness unavailable',
      );
      expect(result.finalState.reviewState?.category).toBe(
        'TOOL_EXECUTION_FAILURE',
      );
    });

    it('fails closed to ROUTED_TO_MANUAL_REVIEW without calling any tool when consent is not VALID', async () => {
      const caseId = await makeCase();
      await addEvidence(caseId, EvidenceType.INCOME, { monthlyIncome: 9000 });
      await addEvidence(caseId, EvidenceType.CREDIT, {});
      await addEvidence(caseId, EvidenceType.DOCUMENT, {});

      const result = await runtime.run(
        makeInput(makeInitialState(caseId, { consentStatus: 'REVOKED' })),
      );

      expect(result.route).toBe('ROUTED_TO_MANUAL_REVIEW');
      expect(result.finalState.attemptedTools).toHaveLength(0);
      expect(result.finalState.reviewState?.reason).toContain(
        'consentStatus is "REVOKED"',
      );
      expect(result.finalState.reviewState?.category).toBe('CONSENT_INVALID');
      const persistedRun = await dataSource
        .getRepository(AgentRun)
        .findOneByOrFail({ caseId });
      expect(persistedRun.reviewCategory).toBe('CONSENT_INVALID');
    });

    it('fails closed to ROUTED_TO_MANUAL_REVIEW without calling any tool when the step budget starts at zero', async () => {
      const caseId = await makeCase();

      const result = await runtime.run(
        makeInput(makeInitialState(caseId, { remainingStepBudget: 0 })),
      );

      expect(result.route).toBe('ROUTED_TO_MANUAL_REVIEW');
      expect(result.finalState.attemptedTools).toHaveLength(0);
      expect(result.finalState.reviewState?.reason).toContain(
        'remainingStepBudget exhausted',
      );
      expect(result.finalState.reviewState?.category).toBe(
        'BUDGET_OR_DEADLINE_EXHAUSTED',
      );
    });

    it('fails closed to ROUTED_TO_MANUAL_REVIEW when the run deadline has already passed', async () => {
      const caseId = await makeCase();
      const state = makeInitialState(caseId, {
        runDeadlineAt: new Date(Date.now() - 1_000).toISOString(),
      });

      const result = await runtime.run(makeInput(state));

      expect(result.route).toBe('ROUTED_TO_MANUAL_REVIEW');
      expect(result.finalState.attemptedTools).toHaveLength(0);
      expect(result.finalState.reviewState?.reason).toContain('runDeadlineAt');
      expect(result.finalState.reviewState?.category).toBe(
        'BUDGET_OR_DEADLINE_EXHAUSTED',
      );
    });
  },
);
