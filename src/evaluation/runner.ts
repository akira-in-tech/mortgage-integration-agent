import { DataSource } from 'typeorm';
import { ApplicationFailure } from '@temporalio/activity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { AgentRun } from '../database/entities/agent-run.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import { EvaluationInputManifest } from '../database/entities/evaluation-input-manifest.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { createCaseConditionsActivities } from '../workflows/case-conditions.activities';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { PolicyEvaluationService } from '../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../policy/evaluation-manifest.service';
import {
  EvaluationCaseFixture,
  EvaluationCaseResult,
  ExpectedOutcome,
} from './types';

export interface EvaluationRunnerDeps {
  dataSource: DataSource;
  policyEvaluationService: PolicyEvaluationService;
  evaluationManifestService: EvaluationManifestService;
  outboxSigningSecret: string;
}

/** Deliberately never given coverage, so `PolicyEvaluationService` fails closed the way `policy-coverage` fixtures need. */
const NOT_COVERED_JURISDICTION_CODE = 'US-EVAL-NC';

/** Ensures the fixed jurisdictions this corpus depends on exist, without assuming a fresh database (idempotent — skips a jurisdiction that's already there). */
async function ensureJurisdictions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Jurisdiction);
  const existingNotCovered = await repo.findOneBy({
    code: NOT_COVERED_JURISDICTION_CODE,
  });
  if (!existingNotCovered) {
    await repo.save(
      repo.create({
        code: NOT_COVERED_JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'Evaluation corpus: deliberately not covered',
        coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
      }),
    );
  }
}

function classifyEvaluateConditionsOutcome(
  outcome: 'CONDITION_OPENED' | 'READY' | 'REVIEW_REQUIRED' | 'INTERRUPTED',
): ExpectedOutcome {
  switch (outcome) {
    case 'CONDITION_OPENED':
      return 'CONDITION_OPENED';
    case 'READY':
      return 'NO_CONDITION';
    case 'REVIEW_REQUIRED':
    case 'INTERRUPTED':
      return 'REVIEW_REQUIRED';
  }
}

/**
 * Runs one fixture through the same real activity functions the M2
 * Temporal workflow calls (`createCaseConditionsActivities`) — not a
 * reimplementation of the policy/Agent logic, the actual production code
 * path, called directly the same way `case-conditions.activities.spec.ts`
 * already does, so the corpus tests what genuinely runs in production.
 */
async function runOneCase(
  deps: EvaluationRunnerDeps,
  activities: ReturnType<typeof createCaseConditionsActivities>,
  tenantId: string,
  fixture: EvaluationCaseFixture,
): Promise<EvaluationCaseResult> {
  const base: Pick<
    EvaluationCaseResult,
    'fixtureId' | 'category' | 'description' | 'expectedOutcome'
  > = {
    fixtureId: fixture.id,
    category: fixture.category,
    description: fixture.description,
    expectedOutcome: fixture.expected.outcome,
  };

  try {
    const caseRepo = deps.dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `evaluation-corpus-${fixture.id}`,
        borrowerId: fixture.borrowerId,
        requestedAmount: fixture.requestedAmount,
        loanType: fixture.loanType,
        statedMonthlyIncome: fixture.statedMonthlyIncome,
        jurisdictionCode: fixture.jurisdictionCode,
        status: CaseStatus.DRAFT,
      }),
    );
    const caseId = loanCase.id;

    if (fixture.category === 'provider-failure') {
      return await runProviderFailureCase(
        activities,
        base,
        tenantId,
        caseId,
        fixture,
      );
    }

    if (fixture.category === 'missing-data') {
      await insertOverrideIncomeEvidence(
        deps.dataSource,
        tenantId,
        caseId,
        fixture,
      );
      await activities.fetchCreditEvidence({
        tenantId,
        caseId,
        borrowerId: fixture.borrowerId,
      });
      await activities.fetchDocumentEvidence({
        tenantId,
        caseId,
        borrowerId: fixture.borrowerId,
      });
    } else {
      await Promise.all([
        activities.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: fixture.borrowerId,
        }),
        activities.fetchCreditEvidence({
          tenantId,
          caseId,
          borrowerId: fixture.borrowerId,
        }),
        activities.fetchDocumentEvidence({
          tenantId,
          caseId,
          borrowerId: fixture.borrowerId,
        }),
      ]);
    }

    const evaluation = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: `evaluation-corpus-${fixture.id}`,
    });
    const actualOutcome = classifyEvaluateConditionsOutcome(evaluation.outcome);
    const actualConditionCode =
      evaluation.outcome === 'CONDITION_OPENED' && evaluation.conditionId
        ? (
            await deps.dataSource
              .getRepository(LoanCondition)
              .findOneBy({ id: evaluation.conditionId })
          )?.code
        : undefined;

    const passed =
      actualOutcome === fixture.expected.outcome &&
      (fixture.expected.conditionCode === undefined ||
        actualConditionCode === fixture.expected.conditionCode);

    return {
      ...base,
      actualOutcome,
      actualConditionCode,
      passed,
      detail: `evaluateConditions outcome=${evaluation.outcome}${
        evaluation.reviewReason ? ` reason="${evaluation.reviewReason}"` : ''
      }`,
    };
  } catch (error) {
    return {
      ...base,
      actualOutcome: 'ERROR',
      passed: false,
      detail: `unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function insertOverrideIncomeEvidence(
  dataSource: DataSource,
  tenantId: string,
  caseId: string,
  fixture: EvaluationCaseFixture,
): Promise<void> {
  const evidenceRepo = dataSource.getRepository(EvidenceFact);
  await evidenceRepo.save(
    evidenceRepo.create({
      tenantId,
      caseId,
      factType: EvidenceType.INCOME,
      sourceKind: EvidenceSourceKind.SIMULATOR,
      sourceIdentifier: 'evaluation-corpus-override',
      value: fixture.incomeEvidenceOverride ?? {},
      observedAt: new Date(),
    }),
  );
}

async function runProviderFailureCase(
  activities: ReturnType<typeof createCaseConditionsActivities>,
  base: Pick<
    EvaluationCaseResult,
    'fixtureId' | 'category' | 'description' | 'expectedOutcome'
  >,
  tenantId: string,
  caseId: string,
  fixture: EvaluationCaseFixture,
): Promise<EvaluationCaseResult> {
  const calls: Record<
    'income' | 'credit' | 'document',
    () => Promise<unknown>
  > = {
    income: () =>
      activities.fetchIncomeEvidence({
        tenantId,
        caseId,
        borrowerId: fixture.borrowerId,
      }),
    credit: () =>
      activities.fetchCreditEvidence({
        tenantId,
        caseId,
        borrowerId: fixture.borrowerId,
      }),
    document: () =>
      activities.fetchDocumentEvidence({
        tenantId,
        caseId,
        borrowerId: fixture.borrowerId,
      }),
  };
  const step = fixture.failingStep ?? 'income';

  try {
    await calls[step]();
    return {
      ...base,
      actualOutcome: 'ERROR',
      passed: false,
      detail: `expected the ${step} fetch to throw, but it succeeded`,
    };
  } catch (error) {
    if (!(error instanceof ApplicationFailure)) {
      return {
        ...base,
        actualOutcome: 'ERROR',
        passed: false,
        detail: `expected an ApplicationFailure, got: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const actualOutcome: ExpectedOutcome = error.nonRetryable
      ? 'PROVIDER_TERMINAL_FAILURE'
      : 'PROVIDER_TRANSIENT_FAILURE';
    return {
      ...base,
      actualOutcome,
      passed: actualOutcome === fixture.expected.outcome,
      detail: `${step} fetch failed: type=${error.type} nonRetryable=${error.nonRetryable}`,
    };
  }
}

/**
 * Deletes everything a corpus run creates, scoped to the run's own
 * tenant — same discipline as this session's manual verification
 * cleanups, so repeated `npm run evaluate` invocations never accumulate
 * synthetic data.
 */
export async function cleanupEvaluationRun(
  dataSource: DataSource,
  tenantId: string,
): Promise<void> {
  const agentRuns = await dataSource
    .getRepository(AgentRun)
    .find({ where: { tenantId } });
  if (agentRuns.length) {
    await dataSource
      .getRepository(ToolAttempt)
      .delete(agentRuns.map((r) => ({ agentRunId: r.id })));
  }
  await dataSource.getRepository(AgentRun).delete({ tenantId });
  await dataSource.getRepository(EvaluationInputManifest).delete({ tenantId });
  await dataSource.getRepository(OutboxEvent).delete({ tenantId });
  await dataSource.getRepository(EvidenceFact).delete({ tenantId });
  await dataSource.getRepository(CasePolicyBinding).delete({ tenantId });
  await dataSource.getRepository(CasePolicySnapshot).delete({ tenantId });

  const conditions = await dataSource
    .getRepository(LoanCondition)
    .find({ where: { tenantId } });
  if (conditions.length) {
    await dataSource
      .getRepository(ConditionTransition)
      .delete(conditions.map((c) => ({ conditionId: c.id })));
    await dataSource
      .getRepository(LoanCondition)
      .delete(conditions.map((c) => ({ id: c.id })));
  }

  await dataSource.getRepository(LoanCase).delete({ tenantId });
}

export async function runCorpus(
  deps: EvaluationRunnerDeps,
  tenantId: string,
  fixtures: EvaluationCaseFixture[],
): Promise<EvaluationCaseResult[]> {
  await ensureJurisdictions(deps.dataSource);
  const activities = createCaseConditionsActivities({
    dataSource: deps.dataSource,
    plaidService: new PlaidService(),
    creditService: new CreditService(),
    documentService: new DocumentService(),
    policyEvaluationService: deps.policyEvaluationService,
    evaluationManifestService: deps.evaluationManifestService,
    outboxSigningSecret: deps.outboxSigningSecret,
  });

  const results: EvaluationCaseResult[] = [];
  for (const fixture of fixtures) {
    results.push(await runOneCase(deps, activities, tenantId, fixture));
  }
  return results;
}
