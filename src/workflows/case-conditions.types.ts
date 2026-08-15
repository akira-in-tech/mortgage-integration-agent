import { CaseStatus } from '../database/enums/case-status.enum';

export interface CaseConditionsWorkflowInput {
  tenantId: string;
  caseId: string;
  borrowerId: string;
}

export interface CaseConditionsWorkflowResult {
  finalStatus: CaseStatus;
  conditionId?: string;
}
