/**
 * Section 10.6's "future official-source connectors are read-only
 * ingestion adapters" (M0-005's own note), and Charter Section 29 item
 * 4's mechanism half. Mirrors `ProviderAdapter` (`provider-platform/
 * types.ts`) on purpose - a policy source connector is the same shape of
 * problem (pull structured data from something external, on a schedule,
 * without trusting its shape) that this codebase already solved once for
 * provider adapters.
 *
 * What this deliberately does NOT do: author or claim real regulatory
 * content. Section 10.6/10.8 are explicit - "no connector is described
 * as complete coverage until that coverage is reviewed and tested" and
 * "official or proprietary guidelines are not copied into the public
 * repository." A connector can only ever produce a *candidate* revision;
 * whether a jurisdiction is actually `COVERED` remains a separate,
 * human-reviewed fact on the `Jurisdiction` row itself (Section 10.6),
 * completely decoupled from whether a revision exists for it.
 */
export interface PolicySourceConnectorUpdate {
  checksum: string;
  publishedAt: Date;
  content: Record<string, unknown>;
}

export interface PolicySourceConnectorCheckResult {
  changed: boolean;
  update?: PolicySourceConnectorUpdate;
}

export interface PolicySourceConnector {
  /** Matches `PolicySource.id` this connector is responsible for. */
  readonly sourceId: string;

  /**
   * `latestKnownChecksum` is the current `PolicySourceRevision.checksum`
   * for this source (or `null` if none exists yet) - the connector
   * compares against it and reports `changed: false` when nothing new
   * has actually been published, the same "don't write a revision for
   * no reason" discipline a real polling connector needs.
   */
  checkForUpdate(
    latestKnownChecksum: string | null,
  ): Promise<PolicySourceConnectorCheckResult>;
}

/**
 * The one concrete connector in this codebase, and deliberately not a
 * real external HTTP call - there is no real external regulatory feed
 * this project has any right to poll or represent. `fetchLatest` reads
 * from a small, fixed, obviously-synthetic "external bulletin" so the
 * whole ingestion mechanism (change detection, schema-drift detection,
 * candidate-revision creation, human-review framing) is genuinely
 * exercised end to end - proving the *mechanism* works, which is the
 * legitimate engineering half of Section 29 item 4, without pretending
 * to have ingested anything real.
 */
export class DemoPolicySourceConnector implements PolicySourceConnector {
  constructor(
    public readonly sourceId: string,
    private readonly fetchLatest: () => Promise<PolicySourceConnectorUpdate>,
  ) {}

  async checkForUpdate(
    latestKnownChecksum: string | null,
  ): Promise<PolicySourceConnectorCheckResult> {
    const latest = await this.fetchLatest();
    if (latest.checksum === latestKnownChecksum) {
      return { changed: false };
    }
    return { changed: true, update: latest };
  }
}

/**
 * The fixed synthetic "external bulletin" the demo connector polls.
 * Bumping `checksum`/`publishedAt` here and re-running the monitor is
 * the real, repeatable way to demonstrate "the mechanism detects a real
 * change" - exactly analogous to how a SIMULATOR provider adapter
 * returns fixed synthetic findings rather than calling a real vendor.
 */
export async function fetchDemoBulletin(): Promise<PolicySourceConnectorUpdate> {
  return {
    checksum: 'sha256:demo-connector-bulletin-v1',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    content: {
      bulletinId: 'DEMO-2026-01',
      summary:
        'Synthetic demonstration bulletin - proves the connector/monitor mechanism works, not real regulatory content.',
    },
  };
}

/**
 * Every real revision this codebase has ever recorded (the synthetic
 * launch pack, the federal coverage sentinel, this demo bulletin) is a
 * plain object with a `bulletinId`/equivalent identifying field and a
 * `summary` string - not a strict schema, just the minimum shape a
 * human reviewer needs to make sense of a candidate revision. A
 * connector returning something that doesn't even have this is treated
 * as schema drift: flagged, not silently written as if it were a normal
 * revision.
 */
export function detectSchemaDrift(content: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (typeof content !== 'object' || content === null) {
    issues.push('content is not an object');
    return issues;
  }
  if (typeof content.summary !== 'string' || content.summary.length === 0) {
    issues.push('content.summary is missing or not a non-empty string');
  }
  return issues;
}
