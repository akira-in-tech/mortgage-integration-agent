import { DataSource } from 'typeorm';
import {
  EvidenceFact,
  EvidenceType,
} from '../../database/entities/evidence-fact.entity';
import { AgentTool } from '../agent-tool.types';
import { runInTenantContext } from '../../database/tenant-context';

const REQUIRED_FACT_TYPES: EvidenceType[] = [
  EvidenceType.INCOME,
  EvidenceType.CREDIT,
  EvidenceType.DOCUMENT,
];

export type CheckCaseCompletenessArgs = Record<string, never>;

export interface CheckCaseCompletenessResult {
  complete: boolean;
  missingFactTypes: EvidenceType[];
}

export interface CheckCaseCompletenessToolDeps {
  dataSource: DataSource;
}

/**
 * Section 9.4's `check_case_completeness`: "Validate required intake
 * fields", no side effect, no approval boundary. Checks that the case has
 * at least one recorded `EvidenceFact` of each type the M2 case-
 * conditions workflow's evidence-fetch activities produce — a real,
 * meaningful check today, even though nothing in the current deterministic
 * workflow needs to *ask* this (it always fetches all three unconditionally).
 * Ready for a future Agent-runtime caller that decides its own fetch
 * order, not yet invoked by production code.
 */
export function checkCaseCompletenessTool(
  deps: CheckCaseCompletenessToolDeps,
): AgentTool<CheckCaseCompletenessArgs, CheckCaseCompletenessResult> {
  return {
    name: 'check_case_completeness',
    purpose: 'Validate required intake fields',
    sideEffect: 'NONE',
    approvalBoundary: 'No',
    async execute({ tenantId, caseId }) {
      const facts = await runInTenantContext(
        deps.dataSource,
        tenantId,
        (manager) =>
          manager
            .getRepository(EvidenceFact)
            .find({ where: { tenantId, caseId } }),
      );
      const present = new Set(facts.map((f) => f.factType));
      const missingFactTypes = REQUIRED_FACT_TYPES.filter(
        (type) => !present.has(type),
      );
      return { complete: missingFactTypes.length === 0, missingFactTypes };
    },
  };
}
