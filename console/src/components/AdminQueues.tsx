import { useCallback, useEffect, useState } from 'react';
import {
  listProviderOperationIntentsNeedingReconciliation,
  listOpenDataDispositionTasks,
  resolveProviderOperationIntent,
  resolveDataDispositionTask,
  type ProviderOperationIntentQueueItem,
  type DataDispositionTaskQueueItem,
} from '../admin-queues-api';
import { DataTable } from './DataTable';

// Two reviewer queues on one screen: provider calls whose outcome is
// still unclear, and evidence waiting on a delete/anonymize/retain
// decision after a consent revocation. Both work the same way — load a
// list, pick a row, submit a decision, refresh.
export function AdminQueues() {
  const [intents, setIntents] = useState<ProviderOperationIntentQueueItem[]>(
    [],
  );
  const [tasks, setTasks] = useState<DataDispositionTaskQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [intentsError, setIntentsError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [intentsResult, tasksResult] = await Promise.allSettled([
      listProviderOperationIntentsNeedingReconciliation(),
      listOpenDataDispositionTasks(),
    ]);
    if (intentsResult.status === 'fulfilled') {
      setIntents(intentsResult.value);
      setIntentsError(null);
    } else {
      setIntentsError(intentsResult.reason.message);
    }
    if (tasksResult.status === 'fulfilled') {
      setTasks(tasksResult.value);
      setTasksError(null);
    } else {
      setTasksError(tasksResult.reason.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <Placeholder>Loading admin queues…</Placeholder>;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        background: 'var(--page)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 5px' }}>Admin Queues</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            Provider call outcomes and data-disposition decisions waiting on a
            reviewer
          </div>
        </div>
        <button className="btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <ProviderReconciliationSection
        intents={intents}
        error={intentsError}
        onResolved={refresh}
      />

      <DataDispositionSection
        tasks={tasks}
        error={tasksError}
        onResolved={refresh}
      />
    </div>
  );
}

function ProviderReconciliationSection({
  intents,
  error,
  onResolved,
}: {
  intents: ProviderOperationIntentQueueItem[];
  error: string | null;
  onResolved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(outcome: 'SUCCEEDED' | 'FAILED_FINAL' | 'CANCELLED') {
    if (!selectedId || note.trim().length < 10) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await resolveProviderOperationIntent(selectedId, {
        outcome,
        resolutionNote: note.trim(),
      });
      setMessage(`Recorded as ${outcome}.`);
      setSelectedId(null);
      setNote('');
      onResolved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Could not resolve intent.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="provider-reconciliation-heading"
      style={{ marginBottom: 28 }}
    >
      <h2
        id="provider-reconciliation-heading"
        style={{ fontSize: 15, margin: '0 0 5px' }}
      >
        Provider calls needing reconciliation
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 0 }}>
        A call timed out or never gave a clear answer. Check the
        provider&rsquo;s own records, then record what really happened.
      </p>
      {error ? (
        <InlineError>
          Queue unavailable: {error}. Reviewer access is required.
        </InlineError>
      ) : (
        <DataTable
          columns={[
            'Created',
            'Case',
            'Provider',
            'Capability',
            'State',
            'Action',
          ]}
          emptyLabel="Nothing needs reconciliation right now."
          rows={intents.map((intent) => [
            new Date(intent.createdAt).toLocaleString(),
            <span className="mono" key={`${intent.id}-case`}>
              {intent.caseId.slice(0, 8)}
            </span>,
            intent.providerId,
            intent.capability,
            intent.state,
            <button
              key={`${intent.id}-action`}
              type="button"
              className="btn"
              onClick={() => {
                setSelectedId(intent.id);
                setMessage(null);
              }}
            >
              Resolve
            </button>,
          ])}
        />
      )}

      {selectedId && (
        <ResolutionForm
          heading={`Resolve provider call ${selectedId.slice(0, 8)}`}
          note={note}
          onNoteChange={setNote}
          submitting={submitting}
          onCancel={() => {
            setSelectedId(null);
            setNote('');
          }}
          actions={[
            { label: 'Succeeded', onClick: () => submit('SUCCEEDED') },
            { label: 'Failed', onClick: () => submit('FAILED_FINAL') },
            { label: 'Cancelled', onClick: () => submit('CANCELLED') },
          ]}
        />
      )}

      {message && (
        <div aria-live="polite" style={{ marginTop: 10, fontSize: 12.5 }}>
          {message}
        </div>
      )}
    </section>
  );
}

function DataDispositionSection({
  tasks,
  error,
  onResolved,
}: {
  tasks: DataDispositionTaskQueueItem[];
  error: string | null;
  onResolved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: 'DELETE' | 'ANONYMIZE' | 'RETAIN') {
    if (!selectedId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await resolveDataDispositionTask(selectedId, { action });
      setMessage(`Resolved as ${action}.`);
      setSelectedId(null);
      onResolved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Could not resolve task.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="data-disposition-heading">
      <h2
        id="data-disposition-heading"
        style={{ fontSize: 15, margin: '0 0 5px' }}
      >
        Data disposition
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 0 }}>
        Evidence collected under consent that was later revoked. Decide whether
        to delete it, anonymize it, or keep it under a legal hold.
      </p>
      {error ? (
        <InlineError>
          Queue unavailable: {error}. Reviewer access is required.
        </InlineError>
      ) : (
        <DataTable
          columns={['Created', 'Case', 'Type', 'Reason', 'Action']}
          emptyLabel="No data-disposition tasks are waiting."
          rows={tasks.map((task) => [
            new Date(task.createdAt).toLocaleString(),
            <span className="mono" key={`${task.id}-case`}>
              {task.caseId.slice(0, 8)}
            </span>,
            task.taskType,
            task.reason,
            <button
              key={`${task.id}-action`}
              type="button"
              className="btn"
              onClick={() => {
                setSelectedId(task.id);
                setMessage(null);
              }}
            >
              Resolve
            </button>,
          ])}
        />
      )}

      {selectedId && (
        <ResolutionForm
          heading={`Resolve task ${selectedId.slice(0, 8)}`}
          submitting={submitting}
          onCancel={() => setSelectedId(null)}
          actions={[
            { label: 'Delete', onClick: () => submit('DELETE') },
            { label: 'Anonymize', onClick: () => submit('ANONYMIZE') },
            {
              label: 'Retain (needs a legal hold)',
              onClick: () => submit('RETAIN'),
            },
          ]}
        />
      )}

      {message && (
        <div aria-live="polite" style={{ marginTop: 10, fontSize: 12.5 }}>
          {message}
        </div>
      )}
    </section>
  );
}

// A small shared "pick one of these actions" panel. Some queues (data
// disposition) don't need a note field, so it's optional.
function ResolutionForm({
  heading,
  note,
  onNoteChange,
  submitting,
  onCancel,
  actions,
}: {
  heading: string;
  note?: string;
  onNoteChange?: (value: string) => void;
  submitting: boolean;
  onCancel: () => void;
  actions: { label: string; onClick: () => void }[];
}) {
  const needsNote = onNoteChange !== undefined;
  const noteTooShort = needsNote && (note ?? '').trim().length < 10;

  return (
    <section
      className="card"
      style={{ marginTop: 14, padding: 18, maxWidth: 640 }}
    >
      <h3 style={{ fontSize: 14, marginTop: 0 }}>{heading}</h3>
      {needsNote && (
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>
          What did you find? (at least 10 characters)
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            minLength={10}
            maxLength={2000}
            rows={3}
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          />
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="btn btn-primary"
            disabled={submitting || noteTooShort}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="card"
      style={{ padding: 14, color: 'var(--critical)', fontSize: 12.5 }}
    >
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-muted)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
