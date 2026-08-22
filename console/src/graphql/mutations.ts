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
