import { gql } from '@apollo/client';

export const CASES_QUERY = gql`
  query Cases($status: CaseStatus, $after: String, $first: Int) {
    cases(status: $status, after: $after, first: $first) {
      edges {
        cursor
        node {
          id
          borrowerId
          requestedAmount
          loanType
          status
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const CASE_QUERY = gql`
  query Case($caseId: ID!) {
    case(caseId: $caseId) {
      id
      borrowerId
      requestedAmount
      loanType
      statedMonthlyIncome
      jurisdictionCode
      status
      version
      createdAt
      updatedAt
      evidenceFacts {
        id
        factType
        sourceKind
        sourceIdentifier
        value
        observedAt
        validThrough
      }
      conditions {
        id
        code
        description
        status
        createdAt
        updatedAt
      }
      timeline {
        kind
        summary
        timestamp
        detail
      }
      policyBinding {
        id
        dependencyDigest
        contextKey
        boundAt
        revalidateAfter
        invalidatedAt
        policySnapshot {
          id
          resolutionStatus
          resolverVersion
          contextHash
          resolvedAt
        }
      }
      providerOperations {
        id
        providerId
        capability
        state
        createdAt
        resolvedBy
        resolutionNote
      }
      auditEvents {
        id
        action
        actorId
        resourceType
        resourceId
        reason
        createdAt
      }
      communicationMessages {
        id
        classification
        status
        channel
        recipientRelationship
        renderedContent
        createdAt
        sentAt
        deliveryReference
      }
    }
  }
`;
