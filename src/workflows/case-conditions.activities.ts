import { DataSource, EntityManager } from 'typeorm';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';
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

export interface CaseConditionsActivitiesDeps {
  dataSource: DataSource;
  plaidService: PlaidService;
  creditService: CreditService;
  documentService: DocumentService;
  /** HMAC secret for outbox event signing (Section 15.3). */
  outboxSigningSecret: string;
}

interface CaseRef {
  tenantId: string;
  caseId: string;
}

interface EvaluateConditionsInput extends CaseRef {
  income: PlaidIncomeData;
  credit: CreditBureauData;
  documents: DocumentVerificationResult;
}

interface EvaluateConditionsResult {
  hasOpenCondition: boolean;
  conditionId?: string;
}

interface ResolveConditionInput extends CaseRef {
  conditionId: string;
  actorId: string;
  resolution: ConditionResolutionKind;
  reason?: string;
}

/**
 * Synthetic discrepancy rule for the M2 launch scenario (Section 7.1): a
 * deliberately simple, deterministic stand-in for the real policy engine
 * that M3 introduces. Never treated as a lending decision — it only decides
 * whether the case needs a human-resolvable operational condition before
 * reaching READY_FOR_UNDERWRITING.
 */
function hasSyntheticDiscrepancy(
  credit: CreditBureauData,
  documents: DocumentVerificationResult,
): boolean {
  return (
    credit.derogatoryMarks >= 1 ||
    credit.debtToIncomeRatio > 0.4 ||
    !documents.allDocumentsValid
  );
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
    outboxSigningSecret,
  } = deps;

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
      const income = await plaidService.getIncomeData(borrowerId);
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
      const credit = await creditService.getCreditData(borrowerId);
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
      const documents = await documentService.verifyDocuments(borrowerId);
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

    async evaluateConditions({
      tenantId,
      caseId,
      credit,
      documents,
    }: EvaluateConditionsInput): Promise<EvaluateConditionsResult> {
      if (!hasSyntheticDiscrepancy(credit, documents)) {
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
        return { hasOpenCondition: false };
      }

      const reasons: string[] = [];
      if (credit.derogatoryMarks >= 1) {
        reasons.push(`${credit.derogatoryMarks} derogatory mark(s) on file`);
      }
      if (credit.debtToIncomeRatio > 0.4) {
        reasons.push(
          `DTI of ${(credit.debtToIncomeRatio * 100).toFixed(1)}% exceeds 40%`,
        );
      }
      if (!documents.allDocumentsValid) {
        reasons.push(
          `unresolved document issues: ${documents.failedDocuments.join(', ')}`,
        );
      }

      const conditionId = await dataSource.transaction(async (manager) => {
        const conditionRepo = manager.getRepository(LoanCondition);
        const condition = await conditionRepo.save(
          conditionRepo.create({
            tenantId,
            caseId,
            code: 'SYNTHETIC_DISCREPANCY_REVIEW',
            description: `Review required: ${reasons.join('; ')}.`,
            status: ConditionStatus.OPEN,
          }),
        );
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.CONDITIONS_OPEN },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.ConditionOpened,
          payload: { caseId, conditionId: condition.id, code: condition.code },
        });
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunWaitingForReview,
          payload: { caseId, conditionId: condition.id },
        });
        return condition.id;
      });

      return { hasOpenCondition: true, conditionId };
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
  };
}

export type CaseConditionsActivities = ReturnType<
  typeof createCaseConditionsActivities
>;
