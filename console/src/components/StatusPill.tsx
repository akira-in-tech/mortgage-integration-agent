import type { CaseStatus } from '../graphql/types';
import { AlertTriangleIcon, FlagIcon, CheckIcon } from './icons';
import { STATUS_CONFIG } from './status-config';

export function StatusPill({ status }: { status: CaseStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="pill"
      style={{ background: config.background, color: config.color }}
    >
      {config.icon === 'alert' && (
        <AlertTriangleIcon size={10} color="var(--warning)" />
      )}
      {config.icon === 'flag' && <FlagIcon size={10} color="var(--critical)" />}
      {config.icon === 'check' && <CheckIcon size={10} color="var(--good)" />}
      {!config.icon && (
        <span className="dot" style={{ background: config.dotColor }} />
      )}
      {config.label}
    </span>
  );
}
