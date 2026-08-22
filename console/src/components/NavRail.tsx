import { BrandMark, GridIcon, FolderIcon, ChartIcon, GearIcon } from './icons';

export type ConsoleView = 'dashboard' | 'queue';

interface NavRailProps {
  initials: string;
  activeView: ConsoleView;
  onNavigate: (view: ConsoleView) => void;
}

export function NavRail({ initials, activeView, onNavigate }: NavRailProps) {
  return (
    <div
      style={{
        width: 64,
        flex: 'none',
        background: 'var(--rail)',
        borderRight: '1px solid var(--rail-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 26,
        }}
      >
        <BrandMark />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          aria-label="Ops Dashboard"
          aria-pressed={activeView === 'dashboard'}
          className="navicon"
          style={{
            background: activeView === 'dashboard' ? 'var(--accent-wash)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => onNavigate('dashboard')}
        >
          <GridIcon color={activeView === 'dashboard' ? 'var(--accent)' : 'var(--ink-muted)'} />
        </button>
        <button
          type="button"
          aria-label="Triage Queue"
          aria-pressed={activeView === 'queue'}
          className="navicon"
          style={{
            background: activeView === 'queue' ? 'var(--accent-wash)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => onNavigate('queue')}
        >
          <FolderIcon color={activeView === 'queue' ? 'var(--accent)' : 'var(--ink-muted)'} />
        </button>
        <div className="navicon">
          <ChartIcon color="var(--ink-muted)" />
        </div>
        <div className="navicon">
          <GearIcon color="var(--ink-muted)" />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initials}
      </div>
    </div>
  );
}
