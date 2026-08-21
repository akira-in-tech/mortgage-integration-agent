import { useState } from 'react';
import { useMutation, useApolloClient } from '@apollo/client';
import { SUBMIT_REVIEW_MUTATION, ESCALATE_CASE_MUTATION } from './graphql/mutations';
import { CASE_QUERY } from './graphql/queries';
import { getStoredActorId } from './auth';

// How long after a signal-delivered confirmation to wait before refetching
// again to catch the workflow's own eventual state transition.
const SIGNAL_SETTLE_MS = 2000;

export function useCaseMutations(caseId: string) {
  const client = useApolloClient();
  const [applying, setApplying] = useState(false);

  const [submitReviewMutation, submitReviewState] = useMutation(SUBMIT_REVIEW_MUTATION, {
    refetchQueries: [{ query: CASE_QUERY, variables: { caseId } }],
  });
  const [escalateCaseMutation, escalateState] = useMutation(ESCALATE_CASE_MUTATION, {
    refetchQueries: [{ query: CASE_QUERY, variables: { caseId } }],
  });

  // `submitReview` only ever delivers a Temporal signal (Section 15.1/9.5)
  // — it returns as soon as the workflow acknowledges receipt, not once the
  // workflow has actually processed it and moved the case to its next
  // status. An immediate refetch right after can genuinely land in a real
  // transitional state (the condition already SATISFIED, the case's own
  // `status` not yet advanced) — this isn't a UI bug, it's the real system
  // being asynchronous; a second refetch after it's had a moment to settle
  // catches the case up. `escalateCase`, by contrast, is a real synchronous
  // compare-and-swap and needs no such wait.
  async function resolveCondition(resolution: 'SATISFIED' | 'WAIVED', reason?: string) {
    const actorId = getStoredActorId();
    if (!actorId) throw new Error('No reviewer identity set — reconnect first.');
    await submitReviewMutation({
      variables: {
        caseId,
        input: { reviewType: 'CONDITION_RESOLUTION', actorId, resolution, reason },
      },
    });
    setApplying(true);
    setTimeout(() => {
      client.refetchQueries({ include: [CASE_QUERY] }).finally(() => setApplying(false));
    }, SIGNAL_SETTLE_MS);
  }

  async function escalate(reason: string) {
    const actorId = getStoredActorId();
    if (!actorId) throw new Error('No reviewer identity set — reconnect first.');
    await escalateCaseMutation({
      variables: { caseId, input: { actorId, reason } },
    });
  }

  return {
    resolveCondition,
    escalate,
    resolvingCondition: submitReviewState.loading || applying,
    escalating: escalateState.loading,
    error: submitReviewState.error ?? escalateState.error ?? null,
  };
}
