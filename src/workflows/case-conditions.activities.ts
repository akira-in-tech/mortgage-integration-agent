import { DataSource, EntityManager } from 'typeorm';
import { ApplicationFailure } from '@temporalio/activity';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';
import {
  SyntheticProviderTimeoutError,
  SyntheticProviderRejectionError,
} from '../integrations/synthetic-provider-failures';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import { ConditionResolutionKind } from './case-conditions.signals';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { PolicyEvaluationService } from '../policy/policy-evaluation.service';
import { evaluatePolicyRule } from '../policy/dsl/policy-rule-evaluator';
import { PolicyFactContext } from '../policy/dsl/policy-rule.types';
import { loanTypeToProductCode } from '../policy/product-code';
import { createConditionTool } from '../agent-runtime/tools/create-condition.tool';

const UNDERWRITING_REVIEW_LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';

export interface CaseConditionsActivitiesDeps {
  dataSource: DataSource;
  plaidService: PlaidService;
  creditService: CreditService;
  documentService: DocumentService;
  policyEvaluationService: PolicyEvaluationService;
  /** HMAC secret for outbox event signing (Section 15.3). */
  outboxSigningSecret: string;
}

interface CaseRef {
  tenantId: string;
  caseId: string;
}

interface EvaluateConditionsInput extends CaseRef {
  income: PlaidIncomeData;
}

interface EvaluateConditionsResult {
  outcome: 'READY' | 'CONDITION_OPENED' | 'REVIEW_REQUIRED';
  conditionId?: string;
  reviewReason?: string;
}

interface ResolveConditionInput extends CaseRef {
  conditionId: string;
  actorId: string;
  resolution: ConditionResolutionKind;
  reason?: string;
}

/**
 * Retry-classification boundary (M2 scope: "retry classification"): calls
 * a provider simulator and reinterprets whatever it throws as an
 * ApplicationFailure with an explicit retry decision. `ApplicationFailure
 * .nonRetryable()` forces Temporal to stop after this attempt regardless
 * of the workflow's retry policy, so a terminal synthetic failure never
 * wastes the configured 3 attempts the way a transient one legitimately
 * does. No real provider integration exists yet to observe genuine
 * failure modes from (see synthetic-provider-failures.ts) — an
 * unrecognized error is left untouched rather than guessed at.
 */
async function callProviderWithRetryClassification<T>(
  fn: () => Promise<T>,
  providerName: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SyntheticProviderRejectionError) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        'TerminalProviderFailure',
        providerName,
      );
    }
    if (error instanceof SyntheticProviderTimeoutError) {
      throw ApplicationFailure.retryable(
        error.message,
        'TransientProviderFailure',
        providerName,
      );
    }
    throw error;
  }
}

/**
 * Activities run outside the deterministic workflow sandbox — this is
 * where all I/O (database writes, simulator calls) actually happens. The
 * factory closes over NestJS-resolved services/repositories so activities
 * can reuse the same PlaidService/CreditService/DocumentService the
 * evaluateLoan path already uses, rather than duplicating simulator logic.
 *
 * Every domain write below runs inside `dataSource.transaction()` alongside
 * the outbox event(s) it produces, so a committed state change and its
 * event can never diverge (Section 9.5: "COMMIT STATE AND OUTBOX EVENT";
 * M2 scope: "transactional outbox and signed status event foundation").
 */
export function createCaseConditionsActivities(
  deps: CaseConditionsActivitiesDeps,
) {
  const {
    dataSource,
    plaidService,
    creditService,
    documentService,
    policyEvaluationService,
    outboxSigningSecret,
  } = deps;

  const createCondition = createConditionTool({
    dataSource,
    outboxSigningSecret,
  });

  async function recordEvidence(
    manager: EntityManager,
    params: CaseRef & {
      factType: EvidenceType;
      sourceIdentifier: string;
      value: Record<string, unknown>;
    },
  ): Promise<void> {
    const evidenceRepo = manager.getRepository(EvidenceFact);
    await evidenceRepo.save(
      evidenceRepo.create({
        tenantId: params.tenantId,
        caseId: params.caseId,
        factType: params.factType,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: params.sourceIdentifier,
        value: params.value,
        observedAt: new Date(),
      }),
    );
    await writeOutboxEvent(manager, outboxSigningSecret, {
      tenantId: params.tenantId,
      caseId: params.caseId,
      eventType: OutboxEventType.EvidenceUpdated,
      payload: {
        caseId: params.caseId,
        evidenceType: params.factType,
        sourceIdentifier: params.sourceIdentifier,
      },
    });
  }

  return {
    async markCollectingEvidence({ tenantId, caseId }: CaseRef): Promise<void> {
      await dataSource.transaction(async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.COLLECTING_EVIDENCE },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunStarted,
          payload: { caseId },
        });
      });
    },

    async fetchIncomeEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<PlaidIncomeData> {
      const income = await callProviderWithRetryClassification(
        () => plaidService.getIncomeData(borrowerId),
        'plaid-simulator',
      );
      await dataSource.transaction((manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.INCOME,
          sourceIdentifier: 'plaid-simulator',
          value: income as unknown as Record<string, unknown>,
        }),
      );
      return income;
    },

    async fetchCreditEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<CreditBureauData> {
      const credit = await callProviderWithRetryClassification(
        () => creditService.getCreditData(borrowerId),
        'credit-bureau-simulator',
      );
      await dataSource.transaction((manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.CREDIT,
          sourceIdentifier: 'credit-bureau-simulator',
          value: credit as unknown as Record<string, unknown>,
        }),
      );
      return credit;
    },

    async fetchDocumentEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<DocumentVerificationResult> {
      const documents = await callProviderWithRetryClassification(
        () => documentService.verifyDocuments(borrowerId),
        'document-verification-simulator',
      );
      await dataSource.transaction((manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.DOCUMENT,
          sourceIdentifier: 'document-verification-simulator',
          value: documents as unknown as Record<string, unknown>,
        }),
      );
      return documents;
    },

    /**
     * Policy-driven condition check (Section 10.3's resolver + the M3
     * DSL evaluator, gated through `PolicyEvaluationService`'s binding
     * guard — Section 10.4), replacing the M2 launch's
     * `hasSyntheticDiscrepancy` stand-in now that a real policy engine
     * exists to drive this decision instead. Resolves which released
     * policy version(s) apply to this case's jurisdiction/product/
     * lifecycle event, evaluates each against the case's actual fact
     * context, and opens a condition using the first match's own
     * `outcome.condition`/`reason` — never a hardcoded code/description.
     * An unresolved policy binding (Section 10.3: `REVIEW_REQUIRED` —
     * missing coverage, overlapping versions) routes to manual review
     * rather than silently treating the case as clean.
     */
    async evaluateConditions({
      tenantId,
      caseId,
      income,
    }: EvaluateConditionsInput): Promise<EvaluateConditionsResult> {
      const loanCase = await dataSource
        .getRepository(LoanCase)
        .findOneByOrFail({ id: caseId, tenantId });

      const evaluation = await policyEvaluationService.evaluate(
        tenantId,
        caseId,
        {
          jurisdictionCode: loanCase.jurisdictionCode,
          productCode: loanTypeToProductCode(loanCase.loanType),
          lifecycleEvent: UNDERWRITING_REVIEW_LIFECYCLE_EVENT,
          asOf: new Date(),
        },
      );

      if (evaluation.outcome === 'REVIEW_REQUIRED') {
        return {
          outcome: 'REVIEW_REQUIRED',
          reviewReason: evaluation.resolution.unresolvedReasons.join('; '),
        };
      }

      const factContext: PolicyFactContext = {
        application: { monthly_income: Number(loanCase.statedMonthlyIncome) },
        evidence: { verified_monthly_income: income.monthlyIncome },
      };

      const match = evaluation.resolution.versions
        .map((resolved) => ({
          resolved,
          result: evaluatePolicyRule(resolved.rule, factContext),
        }))
        .find(({ result }) => result.matched);

      if (!match) {
        await dataSource.transaction(async (manager) => {
          await manager
            .getRepository(LoanCase)
            .update(
              { id: caseId, tenantId },
              { status: CaseStatus.READY_FOR_UNDERWRITING },
            );
          await writeOutboxEvent(manager, outboxSigningSecret, {
            tenantId,
            caseId,
            eventType: OutboxEventType.WorkflowRunCompleted,
            payload: { caseId, finalStatus: CaseStatus.READY_FOR_UNDERWRITING },
          });
        });
        return { outcome: 'READY' };
      }

      const { conditionId } = await createCondition.execute(
        { tenantId, caseId },
        {
          code: match.resolved.rule.outcome.condition,
          description: match.result.reason,
          policyVersionId: match.resolved.policyVersionId,
          ruleId: match.resolved.ruleId,
          policySnapshotId: evaluation.snapshot.id,
        },
      );

      return { outcome: 'CONDITION_OPENED', conditionId };
    },

    async resolveCondition({
      tenantId,
      caseId,
      conditionId,
      actorId,
      resolution,
      reason,
    }: ResolveConditionInput): Promise<void> {
      const toStatus =
        resolution === 'SATISFIED'
          ? ConditionStatus.SATISFIED
          : ConditionStatus.WAIVED;

      await dataSource.transaction(async (manager) => {
        const conditionRepo = manager.getRepository(LoanCondition);
        const condition = await conditionRepo.findOneByOrFail({
          id: conditionId,
        });
        await conditionRepo.update({ id: conditionId }, { status: toStatus });
        await manager.getRepository(ConditionTransition).save(
          manager.getRepository(ConditionTransition).create({
            conditionId,
            fromStatus: condition.status,
            toStatus,
            actorId,
            reason: reason ?? null,
          }),
        );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType:
            resolution === 'SATISFIED'
              ? OutboxEventType.ConditionSatisfied
              : OutboxEventType.ConditionWaived,
          payload: {
            caseId,
            conditionId,
            actorId,
            resolution,
            reason: reason ?? null,
          },
        });
      });
    },

    async markReadyForUnderwriting({
      tenantId,
      caseId,
    }: CaseRef): Promise<void> {
      await dataSource.transaction(async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.READY_FOR_UNDERWRITING },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunCompleted,
          payload: { caseId, finalStatus: CaseStatus.READY_FOR_UNDERWRITING },
        });
      });
    },

    /**
     * Escape hatch for an unrecoverable activity failure (evidence
     * fetching exhausted its retries, or hit a terminal provider error) —
     * mirrors Section 9.5's "budget or runtime failure: route to manual
     * review" Agent-loop pattern at the workflow level. `reason` is the
     * classified failure's message, safe to log verbatim since it never
     * contains borrower data (see synthetic-provider-failures.ts).
     */
    async markManualReview({
      tenantId,
      caseId,
      reason,
    }: CaseRef & { reason: string }): Promise<void> {
      await dataSource.transaction(async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.MANUAL_REVIEW },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunFailed,
          payload: { caseId, reason },
        });
      });
    },
  };
}

export type CaseConditionsActivities = ReturnType<
  typeof createCaseConditionsActivities
>;
