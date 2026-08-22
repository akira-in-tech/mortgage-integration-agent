/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation SubmitReview($caseId: ID!, $input: ReviewDto!) {\n    submitReview(caseId: $caseId, input: $input)\n  }\n": typeof types.SubmitReviewDocument,
    "\n  mutation EscalateCase($caseId: ID!, $input: EscalateDto!) {\n    escalateCase(caseId: $caseId, input: $input) {\n      id\n      status\n      version\n    }\n  }\n": typeof types.EscalateCaseDocument,
    "\n  mutation ApproveCommunicationMessage(\n    $messageId: ID!\n    $input: ApproveCommunicationMessageDto!\n  ) {\n    approveCommunicationMessage(messageId: $messageId, input: $input) {\n      id\n      approvedAt\n    }\n  }\n": typeof types.ApproveCommunicationMessageDocument,
    "\n  mutation SendCommunicationMessage($messageId: ID!) {\n    sendCommunicationMessage(messageId: $messageId) {\n      outcome\n      deliveryReference\n      sentAt\n    }\n  }\n": typeof types.SendCommunicationMessageDocument,
    "\n  query Cases($status: CaseStatus, $after: String, $first: Int) {\n    cases(status: $status, after: $after, first: $first) {\n      edges {\n        cursor\n        node {\n          id\n          borrowerId\n          requestedAmount\n          loanType\n          status\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.CasesDocument,
    "\n  query CaseStatusCounts {\n    caseStatusCounts {\n      status\n      count\n    }\n  }\n": typeof types.CaseStatusCountsDocument,
    "\n  query RecentActivity($limit: Int) {\n    recentActivity(limit: $limit) {\n      id\n      action\n      actorId\n      resourceType\n      resourceId\n      reason\n      createdAt\n    }\n  }\n": typeof types.RecentActivityDocument,
    "\n  query Case($caseId: ID!) {\n    case(caseId: $caseId) {\n      id\n      borrowerId\n      requestedAmount\n      loanType\n      statedMonthlyIncome\n      jurisdictionCode\n      status\n      version\n      createdAt\n      updatedAt\n      evidenceFacts {\n        id\n        factType\n        sourceKind\n        sourceIdentifier\n        value\n        observedAt\n        validThrough\n      }\n      conditions {\n        id\n        code\n        description\n        status\n        createdAt\n        updatedAt\n      }\n      timeline {\n        kind\n        summary\n        timestamp\n        detail\n      }\n      policyBinding {\n        id\n        dependencyDigest\n        contextKey\n        boundAt\n        revalidateAfter\n        invalidatedAt\n        policySnapshot {\n          id\n          resolutionStatus\n          resolverVersion\n          contextHash\n          resolvedAt\n        }\n      }\n      providerOperations {\n        id\n        providerId\n        capability\n        state\n        createdAt\n        resolvedBy\n        resolutionNote\n      }\n      auditEvents {\n        id\n        action\n        actorId\n        resourceType\n        resourceId\n        reason\n        createdAt\n      }\n      communicationMessages {\n        id\n        classification\n        status\n        channel\n        recipientRelationship\n        renderedContent\n        createdAt\n        sentAt\n        deliveryReference\n      }\n    }\n  }\n": typeof types.CaseDocument,
};
const documents: Documents = {
    "\n  mutation SubmitReview($caseId: ID!, $input: ReviewDto!) {\n    submitReview(caseId: $caseId, input: $input)\n  }\n": types.SubmitReviewDocument,
    "\n  mutation EscalateCase($caseId: ID!, $input: EscalateDto!) {\n    escalateCase(caseId: $caseId, input: $input) {\n      id\n      status\n      version\n    }\n  }\n": types.EscalateCaseDocument,
    "\n  mutation ApproveCommunicationMessage(\n    $messageId: ID!\n    $input: ApproveCommunicationMessageDto!\n  ) {\n    approveCommunicationMessage(messageId: $messageId, input: $input) {\n      id\n      approvedAt\n    }\n  }\n": types.ApproveCommunicationMessageDocument,
    "\n  mutation SendCommunicationMessage($messageId: ID!) {\n    sendCommunicationMessage(messageId: $messageId) {\n      outcome\n      deliveryReference\n      sentAt\n    }\n  }\n": types.SendCommunicationMessageDocument,
    "\n  query Cases($status: CaseStatus, $after: String, $first: Int) {\n    cases(status: $status, after: $after, first: $first) {\n      edges {\n        cursor\n        node {\n          id\n          borrowerId\n          requestedAmount\n          loanType\n          status\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.CasesDocument,
    "\n  query CaseStatusCounts {\n    caseStatusCounts {\n      status\n      count\n    }\n  }\n": types.CaseStatusCountsDocument,
    "\n  query RecentActivity($limit: Int) {\n    recentActivity(limit: $limit) {\n      id\n      action\n      actorId\n      resourceType\n      resourceId\n      reason\n      createdAt\n    }\n  }\n": types.RecentActivityDocument,
    "\n  query Case($caseId: ID!) {\n    case(caseId: $caseId) {\n      id\n      borrowerId\n      requestedAmount\n      loanType\n      statedMonthlyIncome\n      jurisdictionCode\n      status\n      version\n      createdAt\n      updatedAt\n      evidenceFacts {\n        id\n        factType\n        sourceKind\n        sourceIdentifier\n        value\n        observedAt\n        validThrough\n      }\n      conditions {\n        id\n        code\n        description\n        status\n        createdAt\n        updatedAt\n      }\n      timeline {\n        kind\n        summary\n        timestamp\n        detail\n      }\n      policyBinding {\n        id\n        dependencyDigest\n        contextKey\n        boundAt\n        revalidateAfter\n        invalidatedAt\n        policySnapshot {\n          id\n          resolutionStatus\n          resolverVersion\n          contextHash\n          resolvedAt\n        }\n      }\n      providerOperations {\n        id\n        providerId\n        capability\n        state\n        createdAt\n        resolvedBy\n        resolutionNote\n      }\n      auditEvents {\n        id\n        action\n        actorId\n        resourceType\n        resourceId\n        reason\n        createdAt\n      }\n      communicationMessages {\n        id\n        classification\n        status\n        channel\n        recipientRelationship\n        renderedContent\n        createdAt\n        sentAt\n        deliveryReference\n      }\n    }\n  }\n": types.CaseDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SubmitReview($caseId: ID!, $input: ReviewDto!) {\n    submitReview(caseId: $caseId, input: $input)\n  }\n"): (typeof documents)["\n  mutation SubmitReview($caseId: ID!, $input: ReviewDto!) {\n    submitReview(caseId: $caseId, input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation EscalateCase($caseId: ID!, $input: EscalateDto!) {\n    escalateCase(caseId: $caseId, input: $input) {\n      id\n      status\n      version\n    }\n  }\n"): (typeof documents)["\n  mutation EscalateCase($caseId: ID!, $input: EscalateDto!) {\n    escalateCase(caseId: $caseId, input: $input) {\n      id\n      status\n      version\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ApproveCommunicationMessage(\n    $messageId: ID!\n    $input: ApproveCommunicationMessageDto!\n  ) {\n    approveCommunicationMessage(messageId: $messageId, input: $input) {\n      id\n      approvedAt\n    }\n  }\n"): (typeof documents)["\n  mutation ApproveCommunicationMessage(\n    $messageId: ID!\n    $input: ApproveCommunicationMessageDto!\n  ) {\n    approveCommunicationMessage(messageId: $messageId, input: $input) {\n      id\n      approvedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendCommunicationMessage($messageId: ID!) {\n    sendCommunicationMessage(messageId: $messageId) {\n      outcome\n      deliveryReference\n      sentAt\n    }\n  }\n"): (typeof documents)["\n  mutation SendCommunicationMessage($messageId: ID!) {\n    sendCommunicationMessage(messageId: $messageId) {\n      outcome\n      deliveryReference\n      sentAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Cases($status: CaseStatus, $after: String, $first: Int) {\n    cases(status: $status, after: $after, first: $first) {\n      edges {\n        cursor\n        node {\n          id\n          borrowerId\n          requestedAmount\n          loanType\n          status\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): (typeof documents)["\n  query Cases($status: CaseStatus, $after: String, $first: Int) {\n    cases(status: $status, after: $after, first: $first) {\n      edges {\n        cursor\n        node {\n          id\n          borrowerId\n          requestedAmount\n          loanType\n          status\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CaseStatusCounts {\n    caseStatusCounts {\n      status\n      count\n    }\n  }\n"): (typeof documents)["\n  query CaseStatusCounts {\n    caseStatusCounts {\n      status\n      count\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecentActivity($limit: Int) {\n    recentActivity(limit: $limit) {\n      id\n      action\n      actorId\n      resourceType\n      resourceId\n      reason\n      createdAt\n    }\n  }\n"): (typeof documents)["\n  query RecentActivity($limit: Int) {\n    recentActivity(limit: $limit) {\n      id\n      action\n      actorId\n      resourceType\n      resourceId\n      reason\n      createdAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Case($caseId: ID!) {\n    case(caseId: $caseId) {\n      id\n      borrowerId\n      requestedAmount\n      loanType\n      statedMonthlyIncome\n      jurisdictionCode\n      status\n      version\n      createdAt\n      updatedAt\n      evidenceFacts {\n        id\n        factType\n        sourceKind\n        sourceIdentifier\n        value\n        observedAt\n        validThrough\n      }\n      conditions {\n        id\n        code\n        description\n        status\n        createdAt\n        updatedAt\n      }\n      timeline {\n        kind\n        summary\n        timestamp\n        detail\n      }\n      policyBinding {\n        id\n        dependencyDigest\n        contextKey\n        boundAt\n        revalidateAfter\n        invalidatedAt\n        policySnapshot {\n          id\n          resolutionStatus\n          resolverVersion\n          contextHash\n          resolvedAt\n        }\n      }\n      providerOperations {\n        id\n        providerId\n        capability\n        state\n        createdAt\n        resolvedBy\n        resolutionNote\n      }\n      auditEvents {\n        id\n        action\n        actorId\n        resourceType\n        resourceId\n        reason\n        createdAt\n      }\n      communicationMessages {\n        id\n        classification\n        status\n        channel\n        recipientRelationship\n        renderedContent\n        createdAt\n        sentAt\n        deliveryReference\n      }\n    }\n  }\n"): (typeof documents)["\n  query Case($caseId: ID!) {\n    case(caseId: $caseId) {\n      id\n      borrowerId\n      requestedAmount\n      loanType\n      statedMonthlyIncome\n      jurisdictionCode\n      status\n      version\n      createdAt\n      updatedAt\n      evidenceFacts {\n        id\n        factType\n        sourceKind\n        sourceIdentifier\n        value\n        observedAt\n        validThrough\n      }\n      conditions {\n        id\n        code\n        description\n        status\n        createdAt\n        updatedAt\n      }\n      timeline {\n        kind\n        summary\n        timestamp\n        detail\n      }\n      policyBinding {\n        id\n        dependencyDigest\n        contextKey\n        boundAt\n        revalidateAfter\n        invalidatedAt\n        policySnapshot {\n          id\n          resolutionStatus\n          resolverVersion\n          contextHash\n          resolvedAt\n        }\n      }\n      providerOperations {\n        id\n        providerId\n        capability\n        state\n        createdAt\n        resolvedBy\n        resolutionNote\n      }\n      auditEvents {\n        id\n        action\n        actorId\n        resourceType\n        resourceId\n        reason\n        createdAt\n      }\n      communicationMessages {\n        id\n        classification\n        status\n        channel\n        recipientRelationship\n        renderedContent\n        createdAt\n        sentAt\n        deliveryReference\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;