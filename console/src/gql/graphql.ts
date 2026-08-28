/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type ApproveCommunicationMessageDto = {
  actorId: string;
  reason?: string | null | undefined;
};

/** Section 6.1's case workflow-readiness status. */
export type CaseStatus =
  | 'CLOSED'
  | 'COLLECTING_EVIDENCE'
  | 'CONDITIONS_OPEN'
  | 'DRAFT'
  | 'MANUAL_REVIEW'
  | 'READY_FOR_UNDERWRITING'
  | 'WAITING_FOR_INFORMATION'
  | 'WAITING_FOR_REVIEW';

export type CheckPolicyChangeImpactDto = {
  policyVersionId: string | number;
};

export type CommunicationClassification =
  | 'PROTECTED'
  | 'ROUTINE';

export type CommunicationMessageStatus =
  | 'APPROVED'
  | 'AWAITING_APPROVAL'
  | 'DRAFTED'
  | 'SENT';

export type ConditionStatus =
  | 'ESCALATED'
  | 'IN_PROGRESS'
  | 'OPEN'
  | 'SATISFIED'
  | 'WAITING_FOR_EVIDENCE'
  | 'WAIVED';

export type EscalateDto = {
  actorId: string;
  reason: string;
};

export type EvidenceSourceKind =
  | 'BORROWER_SUBMITTED'
  | 'SIMULATOR';

export type EvidenceType =
  | 'ASSET'
  | 'CREDIT'
  | 'DOCUMENT'
  | 'IDENTITY'
  | 'INCOME';

/** Supported mortgage loan programs */
export type LoanType =
  | 'CONVENTIONAL'
  | 'FHA'
  | 'JUMBO'
  | 'VA';

export type PolicyChangeImpactKind =
  | 'AMBIGUOUS'
  | 'NO_IMPACT'
  | 'REQUIRES_REEVALUATION';

export type PolicyResolutionStatus =
  | 'RESOLVED'
  | 'REVIEW_REQUIRED';

export type ProviderCapabilityStatus =
  | 'ASSET'
  | 'CREDIT'
  | 'DOCUMENT'
  | 'IDENTITY'
  | 'INCOME';

export type ProviderOperationIntentStatus =
  | 'CANCELLED'
  | 'DISPATCHED'
  | 'FAILED_FINAL'
  | 'OUTCOME_UNKNOWN'
  | 'PREPARED'
  | 'RECONCILING'
  | 'SUCCEEDED';

export type ReviewDto = {
  actorId: string;
  reason?: string | null | undefined;
  resolution?: string | null | undefined;
  reviewType: string;
};

export type SubmitReviewMutationVariables = Exact<{
  caseId: string | number;
  input: ReviewDto;
}>;


export type SubmitReviewMutation = { submitReview: boolean };

export type EscalateCaseMutationVariables = Exact<{
  caseId: string | number;
  input: EscalateDto;
}>;


export type EscalateCaseMutation = { escalateCase: { id: string, status: CaseStatus, version: number } };

export type ApproveCommunicationMessageMutationVariables = Exact<{
  messageId: string | number;
  input: ApproveCommunicationMessageDto;
}>;


export type ApproveCommunicationMessageMutation = { approveCommunicationMessage: { id: string, approvedAt: string } };

export type SendCommunicationMessageMutationVariables = Exact<{
  messageId: string | number;
}>;


export type SendCommunicationMessageMutation = { sendCommunicationMessage: { outcome: string, deliveryReference: string, sentAt: string } };

export type CheckPolicyChangeImpactMutationVariables = Exact<{
  caseId: string | number;
  input: CheckPolicyChangeImpactDto;
}>;


export type CheckPolicyChangeImpactMutation = { checkPolicyChangeImpact: { assessed: boolean, assessmentId: string | null, impact: PolicyChangeImpactKind | null, reason: string | null, details: string | null } };

export type CasesQueryVariables = Exact<{
  status?: CaseStatus | null | undefined;
  after?: string | null | undefined;
  first?: number | null | undefined;
}>;


export type CasesQuery = { cases: { edges: Array<{ cursor: string, node: { id: string, borrowerId: string, requestedAmount: number, loanType: LoanType, status: CaseStatus, createdAt: string } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CaseStatusCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type CaseStatusCountsQuery = { caseStatusCounts: Array<{ status: CaseStatus, count: number }> };

export type RecentActivityQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;


export type RecentActivityQuery = { recentActivity: Array<{ id: string, action: string, actorId: string, resourceType: string, resourceId: string | null, reason: string | null, createdAt: string }> };

export type CaseQueryVariables = Exact<{
  caseId: string | number;
}>;


export type CaseQuery = { case: { id: string, borrowerId: string, requestedAmount: number, loanType: LoanType, statedMonthlyIncome: number, jurisdictionCode: string, status: CaseStatus, version: number, createdAt: string, updatedAt: string, evidenceFacts: Array<{ id: string, factType: EvidenceType, sourceKind: EvidenceSourceKind, sourceIdentifier: string, value: unknown, observedAt: string, validThrough: string | null }>, conditions: Array<{ id: string, code: string, description: string, status: ConditionStatus, createdAt: string, updatedAt: string }>, timeline: Array<{ kind: string, summary: string, timestamp: string, detail: unknown }>, policyBinding: { id: string, dependencyDigest: string, contextKey: string, boundAt: string, revalidateAfter: string, invalidatedAt: string | null, policySnapshot: { id: string, resolutionStatus: PolicyResolutionStatus, resolverVersion: string, contextHash: string, resolvedAt: string } | null } | null, providerOperations: Array<{ id: string, providerId: string, capability: ProviderCapabilityStatus, state: ProviderOperationIntentStatus, createdAt: string, resolvedBy: string | null, resolutionNote: string | null }>, auditEvents: Array<{ id: string, action: string, actorId: string, resourceType: string, resourceId: string | null, reason: string | null, createdAt: string }>, communicationMessages: Array<{ id: string, classification: CommunicationClassification, status: CommunicationMessageStatus, channel: string, recipientRelationship: string, renderedContent: string, createdAt: string, sentAt: string | null, deliveryReference: string | null }> } };


export const SubmitReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReviewDto"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"caseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SubmitReviewMutation, SubmitReviewMutationVariables>;
export const EscalateCaseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EscalateCase"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EscalateDto"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"escalateCase"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"caseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<EscalateCaseMutation, EscalateCaseMutationVariables>;
export const ApproveCommunicationMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ApproveCommunicationMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ApproveCommunicationMessageDto"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"approveCommunicationMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"approvedAt"}}]}}]}}]} as unknown as DocumentNode<ApproveCommunicationMessageMutation, ApproveCommunicationMessageMutationVariables>;
export const SendCommunicationMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendCommunicationMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendCommunicationMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"outcome"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryReference"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}}]}}]}}]} as unknown as DocumentNode<SendCommunicationMessageMutation, SendCommunicationMessageMutationVariables>;
export const CheckPolicyChangeImpactDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CheckPolicyChangeImpact"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CheckPolicyChangeImpactDto"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkPolicyChangeImpact"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"caseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assessed"}},{"kind":"Field","name":{"kind":"Name","value":"assessmentId"}},{"kind":"Field","name":{"kind":"Name","value":"impact"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"details"}}]}}]}}]} as unknown as DocumentNode<CheckPolicyChangeImpactMutation, CheckPolicyChangeImpactMutationVariables>;
export const CasesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Cases"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CaseStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cases"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"borrowerId"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"loanType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<CasesQuery, CasesQueryVariables>;
export const CaseStatusCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CaseStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"caseStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<CaseStatusCountsQuery, CaseStatusCountsQueryVariables>;
export const RecentActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RecentActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recentActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"actorId"}},{"kind":"Field","name":{"kind":"Name","value":"resourceType"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<RecentActivityQuery, RecentActivityQueryVariables>;
export const CaseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Case"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"case"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"caseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"borrowerId"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"loanType"}},{"kind":"Field","name":{"kind":"Name","value":"statedMonthlyIncome"}},{"kind":"Field","name":{"kind":"Name","value":"jurisdictionCode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"evidenceFacts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"factType"}},{"kind":"Field","name":{"kind":"Name","value":"sourceKind"}},{"kind":"Field","name":{"kind":"Name","value":"sourceIdentifier"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"observedAt"}},{"kind":"Field","name":{"kind":"Name","value":"validThrough"}}]}},{"kind":"Field","name":{"kind":"Name","value":"conditions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"policyBinding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dependencyDigest"}},{"kind":"Field","name":{"kind":"Name","value":"contextKey"}},{"kind":"Field","name":{"kind":"Name","value":"boundAt"}},{"kind":"Field","name":{"kind":"Name","value":"revalidateAfter"}},{"kind":"Field","name":{"kind":"Name","value":"invalidatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"policySnapshot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionStatus"}},{"kind":"Field","name":{"kind":"Name","value":"resolverVersion"}},{"kind":"Field","name":{"kind":"Name","value":"contextHash"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerOperations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"providerId"}},{"kind":"Field","name":{"kind":"Name","value":"capability"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedBy"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionNote"}}]}},{"kind":"Field","name":{"kind":"Name","value":"auditEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"actorId"}},{"kind":"Field","name":{"kind":"Name","value":"resourceType"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"communicationMessages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"recipientRelationship"}},{"kind":"Field","name":{"kind":"Name","value":"renderedContent"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryReference"}}]}}]}}]}}]} as unknown as DocumentNode<CaseQuery, CaseQueryVariables>;