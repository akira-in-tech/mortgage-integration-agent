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
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../../database/enums/policy-version.enum';
import { LoanType } from '../../database/enums/loan-type.enum';
import { PolicyApplicabilityResolverService } from '../../policy/policy-applicability-resolver.service';
import { PolicyEvaluationService } from '../../policy/policy-evaluation.service';
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
        dataSource.getRepository(CasePolicySnapshot),
        dataSource.getRepository(CasePolicyBinding),
      );
      runtime = createLendingOperationsAgentRuntime({
        dataSource,
        policyEvaluationService,
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
      }> = {},
    ): Promise<string> {
      const caseRepo = dataSource.getRepository(LoanCase);
      const loanCase = await caseRepo.save(
        caseRepo.create({
          tenantId,
          idempotencyKey: `lgr-spec-${Date.now()}-${Math.random()}`,
          borrowerId: 'lgr-spec-borrower',
          requestedAmount: 300_000,
          loanType: LoanType.CONVENTIONAL,
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
      const updatedCase = await dataSource
        .getRepository(LoanCase)
        .findOneByOrFail({ id: caseId });
      expect(updatedCase.status).toBe(CaseStatus.CONDITIONS_OPEN);
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
    });
  },
);
