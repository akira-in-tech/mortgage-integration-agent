import { graphql } from '../gql';

export const SUBMIT_REVIEW_MUTATION = graphql(`
  mutation SubmitReview($caseId: ID!, $input: ReviewDto!) {
    submitReview(caseId: $caseId, input: $input)
  }
`);

export const ESCALATE_CASE_MUTATION = graphql(`
  mutation EscalateCase($caseId: ID!, $input: EscalateDto!) {
    escalateCase(caseId: $caseId, input: $input) {
      id
      status
      version
    }
  }
`);

export const START_WORKFLOW_RUN_MUTATION = graphql(`
  mutation StartWorkflowRun($caseId: ID!) {
    startWorkflowRun(caseId: $caseId) {
      workflowId
      runId
    }
  }
`);

export const APPROVE_COMMUNICATION_MESSAGE_MUTATION = graphql(`
  mutation ApproveCommunicationMessage(
    $messageId: ID!
    $input: ApproveCommunicationMessageDto!
  ) {
    approveCommunicationMessage(messageId: $messageId, input: $input) {
      id
      approvedAt
    }
  }
`);

export const SEND_COMMUNICATION_MESSAGE_MUTATION = graphql(`
  mutation SendCommunicationMessage($messageId: ID!) {
    sendCommunicationMessage(messageId: $messageId) {
      outcome
      deliveryReference
      sentAt
    }
  }
`);

// Checks whether a specific policy version (usually one that was just
// published) would change how this one case resolves — without
// actually changing anything on the case. There's no query anywhere
// yet to browse existing policy versions, so the reviewer has to
// already know the id they want to check (from whoever published it).
export const CHECK_POLICY_CHANGE_IMPACT_MUTATION = graphql(`
  mutation CheckPolicyChangeImpact(
    $caseId: ID!
    $input: CheckPolicyChangeImpactDto!
  ) {
    checkPolicyChangeImpact(caseId: $caseId, input: $input) {
      assessed
      assessmentId
      impact
      reason
      details
    }
  }
`);
