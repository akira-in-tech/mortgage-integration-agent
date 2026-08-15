import { DataSource } from 'typeorm';
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

export interface CaseConditionsActivitiesDeps {
  dataSource: DataSource;
  plaidService: PlaidService;
  creditService: CreditService;
  documentService: DocumentService;
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
 */
export function createCaseConditionsActivities(
  deps: CaseConditionsActivitiesDeps,
) {
  const { dataSource, plaidService, creditService, documentService } = deps;
  const caseRepo = dataSource.getRepository(LoanCase);
  const evidenceRepo = dataSource.getRepository(EvidenceFact);
  const conditionRepo = dataSource.getRepository(LoanCondition);
  const transitionRepo = dataSource.getRepository(ConditionTransition);

  return {
    async markCollectingEvidence({ tenantId, caseId }: CaseRef): Promise<void> {
      await caseRepo.update(
        { id: caseId, tenantId },
        { status: CaseStatus.COLLECTING_EVIDENCE },
      );
    },

    async fetchIncomeEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<PlaidIncomeData> {
      const income = await plaidService.getIncomeData(borrowerId);
      await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId,
          factType: EvidenceType.INCOME,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'plaid-simulator',
          value: income as unknown as Record<string, unknown>,
          observedAt: new Date(),
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
      await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId,
          factType: EvidenceType.CREDIT,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'credit-bureau-simulator',
          value: credit as unknown as Record<string, unknown>,
          observedAt: new Date(),
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
      await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId,
          factType: EvidenceType.DOCUMENT,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'document-verification-simulator',
          value: documents as unknown as Record<string, unknown>,
          observedAt: new Date(),
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
        await caseRepo.update(
          { id: caseId, tenantId },
          { status: CaseStatus.READY_FOR_UNDERWRITING },
        );
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

      const condition = await conditionRepo.save(
        conditionRepo.create({
          tenantId,
          caseId,
          code: 'SYNTHETIC_DISCREPANCY_REVIEW',
          description: `Review required: ${reasons.join('; ')}.`,
          status: ConditionStatus.OPEN,
        }),
      );
      await caseRepo.update(
        { id: caseId, tenantId },
        { status: CaseStatus.CONDITIONS_OPEN },
      );

      return { hasOpenCondition: true, conditionId: condition.id };
    },

    async resolveCondition({
      conditionId,
      actorId,
      resolution,
      reason,
    }: ResolveConditionInput): Promise<void> {
      const toStatus =
        resolution === 'SATISFIED'
          ? ConditionStatus.SATISFIED
          : ConditionStatus.WAIVED;

      const condition = await conditionRepo.findOneByOrFail({
        id: conditionId,
      });
      await conditionRepo.update({ id: conditionId }, { status: toStatus });
      await transitionRepo.save(
        transitionRepo.create({
          conditionId,
          fromStatus: condition.status,
          toStatus,
          actorId,
          reason: reason ?? null,
        }),
      );
    },

    async markReadyForUnderwriting({
      tenantId,
      caseId,
    }: CaseRef): Promise<void> {
      await caseRepo.update(
        { id: caseId, tenantId },
        { status: CaseStatus.READY_FOR_UNDERWRITING },
      );
    },
  };
}

export type CaseConditionsActivities = ReturnType<
  typeof createCaseConditionsActivities
>;
