import type { LoanCase } from '../../graphql/types';
import { DataTable } from '../DataTable';
import { formatDateTime } from '../../format';

export function AuditTab({ loanCase }: { loanCase: LoanCase }) {
  const events = [...(loanCase.auditEvents ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <DataTable
      columns={['Action', 'Actor', 'Reason', 'Timestamp']}
      emptyLabel="No audit events recorded for this case yet."
      rows={events.map((event) => [
        event.action,
        <span className="mono">{event.actorId}</span>,
        event.reason ?? '—',
        formatDateTime(event.createdAt),
      ])}
    />
  );
}
