import { useMutation } from '@apollo/client';
import type { LoanCase } from '../../graphql/types';
import {
  APPROVE_COMMUNICATION_MESSAGE_MUTATION,
  SEND_COMMUNICATION_MESSAGE_MUTATION,
} from '../../graphql/mutations';
import { CASE_QUERY } from '../../graphql/queries';
import { getStoredActorId } from '../../auth';
import { formatDateTime } from '../../format';

export function CommunicationsTab({ loanCase }: { loanCase: LoanCase }) {
  const messages = loanCase.communicationMessages ?? [];
  const [approve, approveState] = useMutation(
    APPROVE_COMMUNICATION_MESSAGE_MUTATION,
    {
      refetchQueries: [
        { query: CASE_QUERY, variables: { caseId: loanCase.id } },
      ],
    },
  );
  const [send, sendState] = useMutation(SEND_COMMUNICATION_MESSAGE_MUTATION, {
    refetchQueries: [{ query: CASE_QUERY, variables: { caseId: loanCase.id } }],
  });
  const error = approveState.error ?? sendState.error ?? null;

  if (messages.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}
      >
        No communication messages on this case.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--critical)' }}>
          {error.message}
        </div>
      )}
      {messages.map((message) => (
        <div
          key={message.id}
          className="card"
          style={{
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {message.classification} &middot; {message.channel}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--ink-muted)',
                marginTop: 2,
              }}
            >
              {message.status} &middot; drafted{' '}
              {formatDateTime(message.createdAt)}
              {message.sentAt
                ? ` · sent ${formatDateTime(message.sentAt)}`
                : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {message.status === 'AWAITING_APPROVAL' && (
              <button
                className="btn"
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={approveState.loading}
                onClick={() => {
                  const actorId = getStoredActorId();
                  if (!actorId) return;
                  approve({
                    variables: { messageId: message.id, input: { actorId } },
                  });
                }}
              >
                Approve
              </button>
            )}
            {(message.status === 'DRAFTED' ||
              message.status === 'APPROVED') && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={sendState.loading}
                onClick={() => send({ variables: { messageId: message.id } })}
              >
                Send
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
