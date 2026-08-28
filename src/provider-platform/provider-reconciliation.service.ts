import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { ProviderOperationIntent as ProviderOperationIntentEntity } from '../database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentStatus } from '../database/enums/provider-platform.enum';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { runWithRlsBypass } from '../database/tenant-context';

/** Bounds how much work one `reconcilePendingIntents()` call does — same real production-safety property `WebhookDispatchService`'s own `EVENT_BATCH_SIZE` already established. */
const RECONCILIATION_BATCH_SIZE = 100;

export interface ReconcilePendingIntentsOptions {
  /** Injectable clock, same pattern as `webhook-dispatch.service.ts`'s own `now` option — lets tests simulate an intent aging past the threshold without a real wall-clock wait. */
  now?: Date;
}

export interface ReconcilePendingIntentsResult {
  scanned: number;
  movedToReconciling: number;
}

/**
 * Section 11.5: "After an ambiguous timeout, the state becomes
 * OUTCOME_UNKNOWN... a reconciliation workflow resolves it." This is that
 * workflow — honestly scoped to what's real: **no automatic resolution
 * path exists**. Section 11.5's own fuller design assumes a provider
 * adapter can be asked "what actually happened" (`ProviderAdapter.poll()`
 * against a persisted receipt) — but no adapter in this codebase
 * implements `poll()` (every one is synchronous; see `types.ts`'s own
 * comment), *and* no receipt is ever persisted for a later poll to use
 * even if one did. Building a poll-calling branch here would be dead
 * code exercising nothing real — this service does the one honest thing
 * available instead: find an `OUTCOME_UNKNOWN` intent old enough that
 * automatic resolution clearly isn't coming, and move it to
 * `RECONCILING` — Section 11.5's own next state, meaning "a human needs
 * to look at this," not silence. `resolve-provider-operation-intent.ts`
 * is the real, human, out-of-band resolution path after that.
 *
 * `worker.ts` calls this on a plain interval, the identical "not a
 * Temporal workflow" reasoning `WebhookDispatchService` already
 * established: an intent row already *is* the durable record of what's
 * outstanding, so a crash between polls loses nothing.
 */
@Injectable()
export class ProviderReconciliationService {
  private readonly logger = new Logger(ProviderReconciliationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly intentService: ProviderOperationIntentService,
  ) {}

  async reconcilePendingIntents(
    staleAfterMs: number,
    options: ReconcilePendingIntentsOptions = {},
  ): Promise<ReconcilePendingIntentsResult> {
    const now = options.now ?? new Date();
    const threshold = new Date(now.getTime() - staleAfterMs);

    // Genuinely cross-tenant by design — the same reasoning
    // WebhookDispatchService's own due-event/due-delivery scans already
    // established: this is a platform-operational sweep across every
    // tenant's own intents, not one tenant's own request.
    const staleIntents = await runWithRlsBypass(this.dataSource, (manager) =>
      manager.getRepository(ProviderOperationIntentEntity).find({
        where: {
          state: ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
          updatedAt: LessThanOrEqual(threshold),
        },
        order: { updatedAt: 'ASC' },
        take: RECONCILIATION_BATCH_SIZE,
      }),
    );

    let movedToReconciling = 0;
    for (const intent of staleIntents) {
      try {
        await this.intentService.markReconciling(intent.tenantId, intent.id);
        movedToReconciling++;
      } catch (error) {
        this.logger.error(
          `Failed to move intent ${intent.id} to RECONCILING: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { scanned: staleIntents.length, movedToReconciling };
  }
}
