import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import {
  PolicySourceConnector,
  detectSchemaDrift,
} from './policy-source-connector';

export type PolicySourceCheckOutcome =
  'no_change' | 'new_revision' | 'schema_drift' | 'error';

export interface PolicySourceMonitorResult {
  sourceId: string;
  outcome: PolicySourceCheckOutcome;
  detail?: string;
}

/**
 * Section 10.6's monitoring half of "future official-source connectors
 * are read-only ingestion adapters... Source monitors update freshness
 * and candidate revisions asynchronously" - and Section 29 item 4's
 * mechanism. Mirrors `ProviderReconciliationService`'s own shape
 * exactly: scan, detect, act only within a narrow and honest boundary,
 * flag anything else for a human. Here that means: detect a real change
 * -> record a new candidate `PolicySourceRevision` (never touches
 * `Jurisdiction.coverageStatus`, which stays a separate, human-reviewed
 * fact); detect a shape the connector was never supposed to send ->
 * log a schema-drift warning and write nothing, rather than silently
 * accepting content nobody has reviewed the shape of.
 *
 * Only `CONNECTOR`-mode sources are ever scanned - `SYNTHETIC` and
 * `MANUAL` sources have no connector to poll and are explicitly outside
 * this service's job (Section 10.6: monitoring only applies to sources
 * that are actually being monitored).
 */
@Injectable()
export class PolicySourceMonitorService {
  private readonly logger = new Logger(PolicySourceMonitorService.name);

  constructor(
    @InjectRepository(PolicySource)
    private readonly sourceRepository: Repository<PolicySource>,
    @InjectRepository(PolicySourceRevision)
    private readonly revisionRepository: Repository<PolicySourceRevision>,
  ) {}

  async checkSource(
    connector: PolicySourceConnector,
  ): Promise<PolicySourceMonitorResult> {
    const source = await this.sourceRepository.findOneBy({
      id: connector.sourceId,
    });
    if (!source) {
      return {
        sourceId: connector.sourceId,
        outcome: 'error',
        detail: 'no such policy source',
      };
    }
    if (source.retrievalMode !== PolicySourceRetrievalMode.CONNECTOR) {
      return {
        sourceId: connector.sourceId,
        outcome: 'error',
        detail: `source retrievalMode is ${source.retrievalMode}, not CONNECTOR - refusing to poll a source no one configured for monitoring`,
      };
    }

    const latestRevision = await this.revisionRepository.findOne({
      where: { policySourceId: source.id },
      order: { recordedAt: 'DESC' },
    });

    let checkResult;
    try {
      checkResult = await connector.checkForUpdate(
        latestRevision?.checksum ?? null,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Policy source connector failed for ${source.name}: ${detail}`,
      );
      return { sourceId: connector.sourceId, outcome: 'error', detail };
    }

    if (!checkResult.changed || !checkResult.update) {
      return { sourceId: connector.sourceId, outcome: 'no_change' };
    }

    const driftIssues = detectSchemaDrift(checkResult.update.content);
    if (driftIssues.length > 0) {
      const detail = driftIssues.join('; ');
      this.logger.warn(
        `Schema drift detected for policy source "${source.name}" - not recording a revision: ${detail}`,
      );
      return { sourceId: connector.sourceId, outcome: 'schema_drift', detail };
    }

    await this.revisionRepository.save({
      policySourceId: source.id,
      checksum: checkResult.update.checksum,
      publishedAt: checkResult.update.publishedAt,
      content: checkResult.update.content,
    });
    this.logger.log(
      `New candidate revision recorded for policy source "${source.name}" (checksum ${checkResult.update.checksum}) - pending human review; this alone does not change the jurisdiction's coverage status.`,
    );
    return { sourceId: connector.sourceId, outcome: 'new_revision' };
  }

  async checkSources(
    connectors: PolicySourceConnector[],
  ): Promise<PolicySourceMonitorResult[]> {
    const results: PolicySourceMonitorResult[] = [];
    for (const connector of connectors) {
      results.push(await this.checkSource(connector));
    }
    return results;
  }
}
