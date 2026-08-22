// Hand-written types matching src/schema.gql exactly (as of M6-005) — a
// codegen pipeline (graphql-code-generator against the real schema) is the
// natural next step once this console has more than one query surface to
// keep in sync; not set up for this first cut to keep the toolchain small.

export type CaseStatus =
  | 'DRAFT'
  | 'COLLECTING_EVIDENCE'
  | 'CONDITIONS_OPEN'
  | 'WAITING_FOR_INFORMATION'
  | 'WAITING_FOR_REVIEW'
  | 'READY_FOR_UNDERWRITING'
  | 'MANUAL_REVIEW'
  | 'CLOSED';

export type LoanType = 'CONVENTIONAL' | 'FHA' | 'VA' | 'JUMBO';

export type ConditionStatus =
  | 'OPEN'
  | 'SATISFIED'
  | 'WAIVED'
  | 'ESCALATED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_EVIDENCE';

export type EvidenceType = 'INCOME' | 'CREDIT' | 'DOCUMENT' | 'IDENTITY' | 'ASSET';
export type EvidenceSourceKind = 'SIMULATOR' | 'BORROWER_SUBMITTED';

export type PolicyResolutionStatus = 'RESOLVED' | 'REVIEW_REQUIRED';

export type ProviderCapabilityStatus =
  | 'INCOME'
  | 'CREDIT'
  | 'DOCUMENT'
  | 'IDENTITY'
  | 'ASSET';

export type ProviderOperationIntentStatus =
  | 'PREPARED'
  | 'DISPATCHED'
  | 'SUCCEEDED'
  | 'OUTCOME_UNKNOWN'
  | 'RECONCILING'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export type CommunicationClassification = 'PROTECTED' | 'ROUTINE';
export type CommunicationMessageStatus =
  | 'DRAFTED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SENT';

export interface EvidenceFact {
  id: string;
  factType: EvidenceType;
  sourceKind: EvidenceSourceKind;
  sourceIdentifier: string;
  value: unknown;
  observedAt: string;
  validThrough: string | null;
}

export interface LoanCondition {
  id: string;
  code: string;
  description: string;
  status: ConditionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  kind: string;
  summary: string;
  timestamp: string;
  detail: unknown;
}

export interface CasePolicySnapshot {
  id: string;
  resolutionStatus: PolicyResolutionStatus;
  resolverVersion: string;
  contextHash: string;
  resolvedAt: string;
}

export interface CasePolicyBinding {
  id: string;
  dependencyDigest: string;
  contextKey: string;
  boundAt: string;
  revalidateAfter: string;
  invalidatedAt: string | null;
  policySnapshot: CasePolicySnapshot | null;
}

export interface ProviderOperationIntent {
  id: string;
  providerId: string;
  capability: ProviderCapabilityStatus;
  state: ProviderOperationIntentStatus;
  createdAt: string;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface CommunicationMessage {
  id: string;
  classification: CommunicationClassification;
  status: CommunicationMessageStatus;
  channel: string;
  recipientRelationship: string;
  renderedContent: string;
  createdAt: string;
  sentAt: string | null;
  deliveryReference: string | null;
}

export interface LoanCase {
  id: string;
  borrowerId: string;
  requestedAmount: number;
  loanType: LoanType;
  statedMonthlyIncome: number;
  jurisdictionCode: string;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  evidenceFacts?: EvidenceFact[];
  conditions?: LoanCondition[];
  timeline?: TimelineEntry[];
  policyBinding?: CasePolicyBinding | null;
  providerOperations?: ProviderOperationIntent[];
  auditEvents?: AuditEvent[];
  communicationMessages?: CommunicationMessage[];
}

export interface CaseEdge {
  cursor: string;
  node: LoanCase;
}

export interface CaseConnection {
  edges: CaseEdge[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

// caseStatusCounts (M6-008) — a status with zero real cases is simply
// absent from the array, never a zero-count entry.
export interface CaseStatusCount {
  status: CaseStatus;
  count: number;
}
