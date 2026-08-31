import { CaseStatus } from '../database/enums/case-status.enum';

export interface CaseConditionsWorkflowInput {
  tenantId: string;
  caseId: string;
  borrowerId: string;
  /**
   * Present only when a reviewer resumes a terminally interrupted run.
   * A recovery is deliberately a new Temporal execution: its bounded Agent
   * budget and audit trail cannot be confused with the execution it replaces.
   */
  recoveryOfRunId?: string;
}

export interface CaseConditionsWorkflowResult {
  finalStatus: CaseStatus;
  conditionId?: string;
}
