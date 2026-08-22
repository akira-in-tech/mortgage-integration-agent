import { useEffect } from 'react';
import { setOidcTenantId, type OidcTenantMembership } from '../oidc';

interface TenantSelectionScreenProps {
  memberships: OidcTenantMembership[];
  onSelected: () => void;
  onCancel: () => void;
}

/**
 * Post-authentication tenant selection. Memberships come from the backend's
 * verified `sub` lookup and cannot be typed or injected by the browser. The
 * selected id is still re-authorized by `OidcGuard` on every later request.
 */
export function TenantSelectionScreen({
  onSelected,
  onCancel,
  memberships,
}: TenantSelectionScreenProps) {
  function select(membership: OidcTenantMembership) {
    setOidcTenantId(membership.tenantId);
    onSelected();
  }

  useEffect(() => {
    if (memberships.length === 1) select(memberships[0]);
    // Memberships are an immutable snapshot from the just-resolved backend
    // session. Selecting exactly once avoids a render loop if the parent
    // recreates its callback while this screen is still mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--page)',
      }}
    >
      <section
        className="card-elevated"
        aria-labelledby="tenant-selection-heading"
        style={{ padding: 32, width: 420 }}
      >
        <h1
          id="tenant-selection-heading"
          style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}
        >
          Choose an organization
        </h1>
        <div
          aria-live="polite"
          style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}
        >
          {memberships.length === 0 &&
            'Your identity is valid, but no tenant membership has been provisioned.'}
        </div>

        {memberships.length > 1 && (
          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            {memberships.map((membership) => (
              <button
                key={membership.tenantId}
                type="button"
                className="btn"
                onClick={() => select(membership)}
                style={{
                  padding: 12,
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span>{membership.tenantName}</span>
                <span className="mono" style={{ color: 'var(--ink-muted)' }}>
                  {membership.role}
                </span>
              </button>
            ))}
          </div>
        )}

        {memberships.length === 0 && (
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
          >
            Sign out
          </button>
        )}
      </section>
    </main>
  );
}
