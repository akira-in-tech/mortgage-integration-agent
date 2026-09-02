import { useCallback, useEffect, useState } from 'react';
import {
  getStoredPlatformAdminToken,
  setStoredPlatformAdminToken,
  clearStoredPlatformAdminToken,
} from '../platform-admin-auth';
import {
  listManifests,
  listActivations,
  getManifestDetail,
  proposeManifest,
  certifyManifest,
  approveManifest,
  activateManifest,
  deactivateProvider,
  listEvaluationReports,
  getEvaluationReport,
  downloadEvaluationReport,
  listPolicyVersions,
  type ProviderPromotionManifest,
  type ProviderActivation,
  type ProviderPromotionManifestDetail,
  type EvaluationReportSummary,
  type EvaluationReportDetail,
  type PolicyVersionSummary,
} from '../platform-admin-api';
import { DataTable } from './DataTable';
import { GearIcon } from './icons';

const CAPABILITIES = ['INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT'];
const MODES = ['SIMULATOR', 'AUTHORIZED_SANDBOX', 'PRODUCTION_BYOC'];

// The provider promotion chain (propose -> certify -> approve -> activate)
// isn't scoped to any tenant — it controls providers shared across the
// whole platform. So this screen is deliberately outside the normal
// tenant console entirely: its own sign-in with its own credential type,
// reached from the connect screen but never mixed with a tenant session.
export function PlatformAdminConsole({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState(() => getStoredPlatformAdminToken());

  if (!token) {
    return (
      <PlatformAdminSignIn
        onConnected={() => setToken(getStoredPlatformAdminToken())}
        onExit={onExit}
      />
    );
  }

  return (
    <PlatformAdminMain
      onSignOut={() => {
        clearStoredPlatformAdminToken();
        setToken(null);
      }}
      onExit={onExit}
    />
  );
}

function PlatformAdminSignIn({
  onConnected,
  onExit,
}: {
  onConnected: () => void;
  onExit: () => void;
}) {
  const [value, setValue] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setStoredPlatformAdminToken(value.trim());
    onConnected();
  }

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
        aria-labelledby="platform-admin-connect-heading"
        style={{ padding: 32, width: 400 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <GearIcon size={16} color="var(--ink-2)" />
          <h1
            id="platform-admin-connect-heading"
            style={{ fontSize: 18, fontWeight: 700, margin: 0 }}
          >
            Platform Admin
          </h1>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-muted)',
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          Not a tenant screen — this drives the provider promotion chain across
          every tenant at once. Paste a platform-admin bearer token (from{' '}
          <code>npm run create-platform-admin</code>).
        </div>
        <form onSubmit={submit}>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000.…"
            className="mono"
            style={{
              width: '100%',
              fontSize: 13,
              padding: '9px 11px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              marginBottom: 16,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Connect
          </button>
        </form>
        <button
          type="button"
          className="btn"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={onExit}
        >
          Back to tenant sign-in
        </button>
      </section>
    </main>
  );
}

function PlatformAdminMain({
  onSignOut,
  onExit,
}: {
  onSignOut: () => void;
  onExit: () => void;
}) {
  const [manifests, setManifests] = useState<ProviderPromotionManifest[]>([]);
  const [activations, setActivations] = useState<ProviderActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(
    null,
  );
  const [showProposeForm, setShowProposeForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [manifestList, activationList] = await Promise.all([
        listManifests(),
        listActivations(),
      ]);
      setManifests(manifestList);
      setActivations(activationList);
      setListError(null);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : 'Could not load provider data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'var(--page)',
      }}
    >
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GearIcon size={15} color="var(--ink-2)" />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            Platform Admin
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="button" onClick={onExit}>
            Tenant sign-in
          </button>
          <button className="btn" type="button" onClick={onSignOut}>
            Disconnect
          </button>
        </div>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {listError && (
          <div
            role="alert"
            className="card"
            style={{
              padding: 14,
              color: 'var(--critical)',
              fontSize: 12.5,
              marginBottom: 20,
            }}
          >
            {listError}
          </div>
        )}

        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div>
              <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Manifests</h2>
              <p
                style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: 0 }}
              >
                Propose -&gt; certify -&gt; approve -&gt; activate. Nothing here
                is reachable by dispatch until it clears all three gates.
              </p>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => setShowProposeForm((v) => !v)}
            >
              {showProposeForm ? 'Cancel' : 'Propose manifest'}
            </button>
          </div>

          {showProposeForm && (
            <ProposeForm
              onProposed={() => {
                setShowProposeForm(false);
                void refresh();
              }}
            />
          )}

          {loading ? (
            <div
              className="card"
              style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}
            >
              Loading…
            </div>
          ) : (
            <DataTable
              columns={[
                'Provider',
                'Capability',
                'Mode',
                'Version',
                'Proposed by',
                'Proposed at',
                'Action',
              ]}
              emptyLabel="No manifests proposed yet."
              rows={manifests.map((manifest) => [
                <span className="mono" key={`${manifest.id}-p`}>
                  {manifest.providerId}
                </span>,
                manifest.capability,
                manifest.mode,
                manifest.version,
                manifest.proposedBy,
                new Date(manifest.proposedAt).toLocaleString(),
                <button
                  key={`${manifest.id}-a`}
                  type="button"
                  className="btn"
                  onClick={() =>
                    setSelectedManifestId(
                      selectedManifestId === manifest.id ? null : manifest.id,
                    )
                  }
                >
                  {selectedManifestId === manifest.id ? 'Hide' : 'View'}
                </button>,
              ])}
            />
          )}

          {selectedManifestId && (
            <ManifestDetail
              manifestId={selectedManifestId}
              onChanged={refresh}
            />
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Active providers</h2>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--ink-muted)',
              margin: '0 0 8px',
            }}
          >
            Every tuple that has ever been activated, across the whole platform
            — this is what real dispatches can actually reach right now.
          </p>
          <DataTable
            columns={[
              'Provider',
              'Capability',
              'Mode',
              'Manifest v',
              'State',
              'Activated by',
              'Activated at',
              'Action',
            ]}
            emptyLabel="No provider has ever been activated."
            rows={activations.map((activation) => [
              <span className="mono" key={`${activation.id}-p`}>
                {activation.providerId}
              </span>,
              activation.capability,
              activation.mode,
              activation.manifestVersion,
              <StatePill key={`${activation.id}-s`} state={activation.state} />,
              activation.activatedBy,
              new Date(activation.activatedAt).toLocaleString(),
              activation.state === 'ACTIVE' ? (
                <DeactivateButton
                  key={`${activation.id}-d`}
                  activation={activation}
                  onDeactivated={refresh}
                />
              ) : (
                <span
                  key={`${activation.id}-d`}
                  style={{ color: 'var(--ink-muted)' }}
                >
                  —
                </span>
              ),
            ])}
          />
        </section>

        <section style={{ marginTop: 28 }}>
          <PolicyVersionBrowser />
        </section>

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>
            Evaluation reports
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--ink-muted)',
              margin: '0 0 8px',
            }}
          >
            Real runs of the release evaluation corpus (
            <code>npm run evaluate</code>) — platform-wide, not any one
            tenant&rsquo;s data.
          </p>
          <EvaluationReportsSection />
        </section>
      </div>
    </div>
  );
}

function PolicyVersionBrowser() {
  const [query, setQuery] = useState('');
  const [versions, setVersions] = useState<PolicyVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (value = '') => {
    setLoading(true);
    try {
      setVersions(await listPolicyVersions(value));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load policy versions.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Policy versions</h2>
      <p
        style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: '0 0 8px' }}
      >
        Immutable catalog metadata and provenance. Browsing does not publish or
        approve policy content.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 10 }}
      >
        <input
          aria-label="Search policy versions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rule, source, or jurisdiction"
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      {error && (
        <div role="alert" style={{ color: 'var(--critical)', fontSize: 12.5 }}>
          {error}
        </div>
      )}
      {loading ? (
        <div className="card" style={{ padding: 18 }}>
          Loading…
        </div>
      ) : (
        <DataTable
          columns={[
            'Rule',
            'Version',
            'Status',
            'Jurisdiction',
            'Source',
            'Effective from',
          ]}
          emptyLabel="No policy versions match this search."
          rows={versions.map((version) => [
            <span className="mono" key={`${version.id}-rule`}>
              {version.ruleId}
            </span>,
            version.version,
            version.releaseStatus,
            version.jurisdictionCode,
            version.sourceName,
            new Date(version.effectiveFrom).toLocaleString(),
          ])}
        />
      )}
    </>
  );
}

function EvaluationReportsSection() {
  const [reports, setReports] = useState<EvaluationReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<EvaluationReportDetail | null>(null);
  const [inspectingId, setInspectingId] = useState<string | null>(null);

  useEffect(() => {
    listEvaluationReports()
      .then((result) => {
        setReports(result);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Could not load reports.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function download(id: string) {
    setDownloadingId(id);
    try {
      const { blob, filename } = await downloadEvaluationReport(id);
      // Standard authenticated-download pattern: the browser has no way
      // to attach an Authorization header to a plain <a href> click, so
      // fetch the bytes ourselves and hand the browser a local blob URL
      // to save instead.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not download report.',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function inspect(id: string) {
    setInspectingId(id);
    setError(null);
    try {
      setSelected(await getEvaluationReport(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load report.');
    } finally {
      setInspectingId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="card"
        style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}
      >
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="card"
        style={{ padding: 14, color: 'var(--critical)', fontSize: 12.5 }}
      >
        {error}
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={[
          'Generated',
          'Commit',
          'Total',
          'Passed',
          'Failed',
          'Recall',
          'Precision',
          'Action',
        ]}
        emptyLabel="No evaluation reports saved yet — run npm run evaluate."
        rows={reports.map((report) => [
          new Date(report.generatedAt).toLocaleString(),
          <span className="mono" key={`${report.id}-c`}>
            {report.gitCommit ? report.gitCommit.slice(0, 8) : '—'}
          </span>,
          report.totalCases,
          report.passed,
          report.failed,
          report.conditionRecall != null
            ? `${Math.round(report.conditionRecall * 100)}%`
            : '—',
          report.conditionPrecision != null
            ? `${Math.round(report.conditionPrecision * 100)}%`
            : '—',
          <span
            key={`${report.id}-actions`}
            style={{ display: 'flex', gap: 6 }}
          >
            <button
              type="button"
              className="btn"
              disabled={inspectingId === report.id}
              onClick={() => void inspect(report.id)}
            >
              {inspectingId === report.id ? 'Loading…' : 'Inspect'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={downloadingId === report.id}
              onClick={() => void download(report.id)}
            >
              {downloadingId === report.id ? 'Downloading…' : 'Download'}
            </button>
          </span>,
        ])}
      />
      {selected && (
        <EvaluationReportDashboard
          report={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// A release dashboard exposes evidence already present in the immutable
// report; it does not recompute quality metrics or turn a pass rate into a
// production-approval claim. It is Platform Admin-only with the report API.
function EvaluationReportDashboard({
  report,
  onClose,
}: {
  report: EvaluationReportDetail;
  onClose: () => void;
}) {
  const { summary, results } = report.report;
  const failures = results.filter((result) => !result.passed);
  const percent = (value: number | null) =>
    value == null ? '—' : `${Math.round(value * 100)}%`;

  return (
    <section
      aria-labelledby="evaluation-dashboard-heading"
      className="card"
      style={{ marginTop: 16, padding: 16 }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <h3
            id="evaluation-dashboard-heading"
            style={{ margin: '0 0 4px', fontSize: 15 }}
          >
            Evaluation run dashboard
          </h3>
          <div style={{ color: 'var(--ink-muted)', fontSize: 12.5 }}>
            {report.report.generatedAt} ·{' '}
            {report.report.codeRevision.gitCommit?.slice(0, 8) ?? 'unversioned'}
          </div>
        </div>
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          margin: '14px 0',
        }}
      >
        <MetricCard
          label="Pass rate"
          value={percent(
            summary.totalCases ? summary.passed / summary.totalCases : null,
          )}
        />
        <MetricCard
          label="Condition recall"
          value={percent(summary.conditionRecall)}
        />
        <MetricCard
          label="Condition precision"
          value={percent(summary.conditionPrecision)}
        />
        <MetricCard label="Failures" value={String(summary.failed)} />
      </div>
      <DataTable
        columns={['Category', 'Passed', 'Total', 'Pass rate']}
        emptyLabel="This report contains no categories."
        rows={Object.entries(summary.byCategory).map(([category, metric]) => [
          category,
          metric.passed,
          metric.total,
          percent(metric.total ? metric.passed / metric.total : null),
        ])}
      />
      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: '0 0 5px', fontSize: 13.5 }}>Failed cases</h4>
        <DataTable
          columns={['Fixture', 'Category', 'Expected', 'Actual', 'Detail']}
          emptyLabel="No failed cases in this saved evaluation run."
          rows={failures.map((result) => [
            result.fixtureId,
            result.category,
            result.expectedConditionCode ?? result.expectedOutcome,
            result.actualConditionCode ?? result.actualOutcome,
            result.detail,
          ])}
        />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}
    >
      <div style={{ color: 'var(--ink-muted)', fontSize: 11.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 650, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const active = state === 'ACTIVE';
  return (
    <span
      className="pill"
      style={{
        background: active ? 'var(--good-wash)' : 'var(--critical-wash)',
        color: active ? 'var(--good)' : 'var(--critical)',
      }}
    >
      {state}
    </span>
  );
}

function DeactivateButton({
  activation,
  onDeactivated,
}: {
  activation: ProviderActivation;
  onDeactivated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deactivate() {
    setBusy(true);
    setError(null);
    try {
      await deactivateProvider({
        providerId: activation.providerId,
        capability: activation.capability,
        mode: activation.mode,
      });
      onDeactivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deactivate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn"
        style={{ color: 'var(--critical)' }}
        disabled={busy}
        onClick={() => void deactivate()}
      >
        Emergency-stop
      </button>
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--critical)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ProposeForm({ onProposed }: { onProposed: () => void }) {
  const [providerId, setProviderId] = useState('');
  const [capability, setCapability] = useState(CAPABILITIES[0]);
  const [mode, setMode] = useState(MODES[0]);
  const [adapterVersion, setAdapterVersion] = useState('');
  const [endpointAllowlist, setEndpointAllowlist] = useState('');
  const [dataClassifications, setDataClassifications] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    providerId.trim() &&
    adapterVersion.trim() &&
    endpointAllowlist.trim() &&
    dataClassifications.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposeManifest({
        providerId: providerId.trim(),
        capability,
        mode,
        adapterVersion: adapterVersion.trim(),
        endpointAllowlist: endpointAllowlist.split(',').map((s) => s.trim()),
        dataClassifications: dataClassifications
          .split(',')
          .map((s) => s.trim()),
      });
      onProposed();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not propose manifest.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ padding: 18, marginBottom: 14, display: 'grid', gap: 10 }}
    >
      <Field label="Provider id">
        <input
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Capability">
          <select
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
          >
            {CAPABILITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Adapter version">
        <input
          value={adapterVersion}
          onChange={(e) => setAdapterVersion(e.target.value)}
          placeholder="1.0.0"
        />
      </Field>
      <Field label="Endpoint allowlist (comma-separated URLs)">
        <input
          value={endpointAllowlist}
          onChange={(e) => setEndpointAllowlist(e.target.value)}
          placeholder="https://sandbox.example.com"
        />
      </Field>
      <Field label="Data classifications (comma-separated)">
        <input
          value={dataClassifications}
          onChange={(e) => setDataClassifications(e.target.value)}
          placeholder="INCOME"
        />
      </Field>
      {error && (
        <div style={{ color: 'var(--critical)', fontSize: 12.5 }}>{error}</div>
      )}
      <div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!valid || submitting}
        >
          Propose
        </button>
      </div>
    </form>
  );
}

function ManifestDetail({
  manifestId,
  onChanged,
}: {
  manifestId: string;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ProviderPromotionManifestDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getManifestDetail(manifestId);
      setDetail(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load manifest.');
    }
  }, [manifestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshBoth() {
    await load();
    onChanged();
  }

  if (error) {
    return (
      <div
        role="alert"
        className="card"
        style={{
          padding: 14,
          color: 'var(--critical)',
          fontSize: 12.5,
          marginTop: 14,
        }}
      >
        {error}
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="card" style={{ padding: 18, marginTop: 14 }}>
      <h3 style={{ fontSize: 14, marginTop: 0 }}>
        {detail.manifest.providerId} / {detail.manifest.capability} /{' '}
        {detail.manifest.mode} — v{detail.manifest.version}
      </h3>
      <div
        style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 14 }}
      >
        Content hash <span className="mono">{detail.manifest.contentHash}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h4 style={{ fontSize: 12.5, margin: '0 0 6px' }}>Certifications</h4>
          <DataTable
            columns={['Environment', 'Decision', 'By', 'Evidence', 'When']}
            emptyLabel="Not certified yet."
            rows={detail.certifications.map((c) => [
              c.environment,
              c.decision,
              c.certifiedBy,
              c.evidenceRef,
              new Date(c.decidedAt).toLocaleString(),
            ])}
          />
          <CertifyForm manifestId={manifestId} onCertified={refreshBoth} />
        </div>
        <div>
          <h4 style={{ fontSize: 12.5, margin: '0 0 6px' }}>Approvals</h4>
          <DataTable
            columns={['Role', 'Decision', 'By', 'When']}
            emptyLabel="Not approved yet."
            rows={detail.approvals.map((a) => [
              a.approvalRole,
              a.decision,
              a.approvedBy,
              new Date(a.decidedAt).toLocaleString(),
            ])}
          />
          <ApproveForm manifestId={manifestId} onApproved={refreshBoth} />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid var(--gridline)',
        }}
      >
        <h4 style={{ fontSize: 12.5, margin: '0 0 6px' }}>Activation</h4>
        <div style={{ fontSize: 12.5, marginBottom: 10 }}>
          {detail.currentActivation ? (
            <>
              Current activation for this tuple: manifest v
              {detail.currentActivation.manifestVersion},{' '}
              <StatePill state={detail.currentActivation.state} /> (by{' '}
              {detail.currentActivation.activatedBy})
            </>
          ) : (
            <span style={{ color: 'var(--ink-muted)' }}>
              This tuple has never been activated.
            </span>
          )}
        </div>
        <ActivateForm
          manifestId={manifestId}
          currentManifestVersion={
            detail.currentActivation?.manifestVersion ?? null
          }
          onActivated={refreshBoth}
        />
      </div>
    </div>
  );
}

function CertifyForm({
  manifestId,
  onCertified,
}: {
  manifestId: string;
  onCertified: () => void;
}) {
  const [environment, setEnvironment] = useState('sandbox');
  const [decision, setDecision] = useState<'PASSED' | 'FAILED' | 'REVOKED'>(
    'PASSED',
  );
  const [evidenceRef, setEvidenceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!evidenceRef.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await certifyManifest(manifestId, {
        environment: environment.trim(),
        decision,
        evidenceRef: evidenceRef.trim(),
      });
      setEvidenceRef('');
      onCertified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not certify.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="mono"
          style={{ flex: 1, fontSize: 12 }}
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          placeholder="environment"
        />
        <select
          style={{ fontSize: 12 }}
          value={decision}
          onChange={(e) => setDecision(e.target.value as typeof decision)}
        >
          <option value="PASSED">PASSED</option>
          <option value="FAILED">FAILED</option>
          <option value="REVOKED">REVOKED</option>
        </select>
      </div>
      <input
        style={{ fontSize: 12 }}
        value={evidenceRef}
        onChange={(e) => setEvidenceRef(e.target.value)}
        placeholder="evidence reference (link or note)"
      />
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--critical)' }}>{error}</div>
      )}
      <button
        type="submit"
        className="btn"
        style={{ fontSize: 12, justifySelf: 'start' }}
        disabled={!evidenceRef.trim() || submitting}
      >
        Record certification
      </button>
    </form>
  );
}

function ApproveForm({
  manifestId,
  onApproved,
}: {
  manifestId: string;
  onApproved: () => void;
}) {
  const [approvalRole, setApprovalRole] = useState('compliance');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'REVOKED'>(
    'APPROVED',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!approvalRole.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await approveManifest(manifestId, {
        approvalRole: approvalRole.trim(),
        decision,
      });
      onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="mono"
          style={{ flex: 1, fontSize: 12 }}
          value={approvalRole}
          onChange={(e) => setApprovalRole(e.target.value)}
          placeholder="approval role"
        />
        <select
          style={{ fontSize: 12 }}
          value={decision}
          onChange={(e) => setDecision(e.target.value as typeof decision)}
        >
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="REVOKED">REVOKED</option>
        </select>
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--critical)' }}>{error}</div>
      )}
      <button
        type="submit"
        className="btn"
        style={{ fontSize: 12, justifySelf: 'start' }}
        disabled={!approvalRole.trim() || submitting}
      >
        Record approval
      </button>
      <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
        Rejected as self-approval if you are the same admin who proposed this
        manifest — the server checks this, not this form.
      </div>
    </form>
  );
}

function ActivateForm({
  manifestId,
  currentManifestVersion,
  onActivated,
}: {
  manifestId: string;
  currentManifestVersion: number | null;
  onActivated: () => void;
}) {
  const [environment, setEnvironment] = useState('sandbox');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await activateManifest(manifestId, {
        environment: environment.trim(),
        expectedCurrentManifestVersion: currentManifestVersion,
      });
      onActivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <input
        className="mono"
        style={{ fontSize: 12, width: 140 }}
        value={environment}
        onChange={(e) => setEnvironment(e.target.value)}
        placeholder="environment"
      />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        disabled={submitting}
      >
        Activate
      </button>
      <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
        Requires a current PASSED certification and APPROVED approval for this
        exact environment.
      </span>
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--critical)' }}>{error}</div>
      )}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}
