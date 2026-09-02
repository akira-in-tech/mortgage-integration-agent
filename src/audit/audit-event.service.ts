import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { runInTenantContext } from '../database/tenant-context';

export interface RecordAuditEventInput {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  correlationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Section 14.1's `audit_events` (M5-019). Always its own short
 * transaction, never sharing one with the action being audited —
 * deliberate, not an oversight: an `RBAC_REJECTED` event has no
 * successful action to piggyback a transaction onto in the first place
 * (the whole point is recording a *rejected* attempt), so every call
 * site uses this same standalone shape for consistency rather than two
 * different integration patterns depending on whether the underlying
 * action happened to already have a transaction open.
 *
 * Failing to *write* an audit event never blocks the action it
 * describes — logged and swallowed, not rethrown. An audit trail gap is
 * a real problem to notice and fix, but it must never become a new way
 * for this codebase's own logging code to break a case creation, a
 * consent revocation, or a reviewer decision that would otherwise have
 * succeeded.
 */
@Injectable()
export class AuditEventService {
  private readonly logger = new Logger(AuditEventService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await runInTenantContext(this.dataSource, input.tenantId, (manager) => {
        const repo = manager.getRepository(AuditEvent);
        return repo.save(
          repo.create({
            tenantId: input.tenantId,
            actorId: input.actorId,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId ?? null,
            correlationId: input.correlationId ?? null,
            reason: input.reason ?? null,
            metadata: input.metadata ?? null,
          }),
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit event [action=${input.action}] [resourceType=${input.resourceType}] [tenantId=${input.tenantId}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Bounded, newest-first tenant read used by the console's own recent-
   * activity view. The tenant context is set in the same transaction as
   * the query so RLS remains a database-level backstop even if a future
   * caller gets filtering wrong.
   */
  async list(tenantId: string, limit: number): Promise<AuditEvent[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).find({
        where: { tenantId },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: Math.min(Math.max(limit, 1), 1000),
      }),
    );
  }

  /**
   * The real export route's own read (M7-055) — `list()`'s own 1,000-row
   * cap was silently truncating any tenant with more history than that,
   * with no indication anywhere in the downloaded file that anything was
   * missing. This walks the full tenant history with real keyset
   * pagination on `(createdAt, id)` — the same stable sort `list()` already
   * uses, just followed past its single-page limit — one bounded page at a
   * time rather than one unbounded query, so it stays real, boundedly
   * expensive work even for a very large tenant. `maxEvents` is a real
   * safety cap, not a silent one: if it's ever actually hit, `truncated`
   * comes back `true` so the export route can say so in the file itself,
   * instead of a reader trusting an export that quietly stopped partway.
   */
  async listAll(
    tenantId: string,
    maxEvents = 50_000,
  ): Promise<{ events: AuditEvent[]; truncated: boolean }> {
    const pageSize = 1000;
    const events: AuditEvent[] = [];
    let cursor: { createdAt: Date; id: string } | undefined;

    const fetchPage = (take: number) =>
      runInTenantContext(this.dataSource, tenantId, (manager) => {
        const qb = manager
          .getRepository(AuditEvent)
          .createQueryBuilder('event')
          .where('event.tenantId = :tenantId', { tenantId })
          .orderBy('event.createdAt', 'DESC')
          .addOrderBy('event.id', 'DESC')
          .take(take);
        if (cursor) {
          qb.andWhere(
            '(event.createdAt < :cursorCreatedAt OR (event.createdAt = :cursorCreatedAt AND event.id < :cursorId))',
            { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
          );
        }
        return qb.getMany();
      });

    let reachedRealEnd = false;
    while (events.length < maxEvents) {
      const page = await fetchPage(pageSize);
      if (page.length === 0) {
        reachedRealEnd = true;
        break;
      }
      events.push(...page);
      const last = page[page.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
      if (page.length < pageSize) {
        reachedRealEnd = true;
        break; // fewer rows than asked for: real end of history
      }
    }

    const trimmed = events.slice(0, maxEvents);
    if (reachedRealEnd && events.length <= maxEvents) {
      return { events: trimmed, truncated: false };
    }
    // Either the cap was hit exactly on a full page, or fetching
    // overshot it — either way, the last page fetched came back full,
    // so completeness genuinely isn't known yet. One real, minimal
    // existence check (not a guess) past the trimmed cursor proves it
    // either way, rather than assuming completeness or truncation.
    const cutoff = trimmed[trimmed.length - 1];
    cursor = { createdAt: cutoff.createdAt, id: cutoff.id };
    const beyondCap = await fetchPage(1);
    return { events: trimmed, truncated: beyondCap.length > 0 };
  }
}
