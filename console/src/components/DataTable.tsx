import type { ReactNode } from 'react';

interface DataTableProps {
  columns: string[];
  rows: ReactNode[][];
  emptyLabel: string;
}

export function DataTable({ columns, rows, emptyLabel }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}>
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: 'left',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-muted)',
                  fontWeight: 600,
                  padding: '9px 20px',
                  borderBottom: '1px solid var(--gridline)',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    fontSize: 13,
                    padding: '11px 20px',
                    borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--gridline)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
