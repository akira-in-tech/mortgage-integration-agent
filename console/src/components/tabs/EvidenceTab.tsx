import type { LoanCase } from '../../graphql/types';
import { formatDateTime } from '../../format';
import { DataTable } from '../DataTable';

export function EvidenceTab({ loanCase }: { loanCase: LoanCase }) {
  const facts = loanCase.evidenceFacts ?? [];
  return (
    <DataTable
      columns={['Type', 'Source', 'Value', 'Observed']}
      emptyLabel="No evidence collected yet."
      rows={facts.map((fact) => [
        fact.factType,
        `${fact.sourceKind}${fact.sourceIdentifier ? ` (${fact.sourceIdentifier})` : ''}`,
        <span className="mono" style={{ wordBreak: 'break-word', display: 'block', maxWidth: 380 }}>
          {JSON.stringify(fact.value)}
        </span>,
        formatDateTime(fact.observedAt),
      ])}
    />
  );
}
