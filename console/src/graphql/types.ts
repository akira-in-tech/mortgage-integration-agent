// Thin re-export layer over generated types (`../gql/graphql.ts`,
// produced by `npm run codegen` from the real backend `src/schema.gql`)
// — kept as its own file so every component's existing `from
// '.../graphql/types'` import stays stable even though the underlying
// types are now generated, not hand-written. Re-run `npm run codegen`
// after any backend schema change; this file's own shape only needs to
// change if a query below adds/removes a field these aliases depend on.

import type {
  CaseQuery,
  CasesQuery,
  CaseStatusCountsQuery,
} from '../gql/graphql';

export type {
  CaseStatus,
  LoanType,
  ConditionStatus,
  EvidenceType,
  EvidenceSourceKind,
  PolicyResolutionStatus,
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../gql/graphql';

export type LoanCase = NonNullable<CaseQuery['case']>;
export type EvidenceFact = LoanCase['evidenceFacts'][number];
export type LoanCondition = LoanCase['conditions'][number];
export type TimelineEntry = LoanCase['timeline'][number];
export type CasePolicyBinding = NonNullable<LoanCase['policyBinding']>;
export type CasePolicySnapshot = NonNullable<
  CasePolicyBinding['policySnapshot']
>;
export type ProviderOperationIntent = LoanCase['providerOperations'][number];
export type AuditEvent = LoanCase['auditEvents'][number];
export type CommunicationMessage = LoanCase['communicationMessages'][number];

export type CaseEdge = CasesQuery['cases']['edges'][number];
export type CaseConnection = CasesQuery['cases'];

export type CaseStatusCount = CaseStatusCountsQuery['caseStatusCounts'][number];
