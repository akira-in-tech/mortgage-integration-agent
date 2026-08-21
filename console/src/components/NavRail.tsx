import { BrandMark, GridIcon, FolderIcon, ChartIcon, GearIcon } from './icons';

export function NavRail({ initials }: { initials: string }) {
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
        <div className="navicon">
          <GridIcon color="var(--ink-muted)" />
        </div>
        <div className="navicon" style={{ background: 'var(--accent-wash)' }}>
          <FolderIcon color="var(--accent)" />
        </div>
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
