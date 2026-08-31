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
   * Bounded, newest-first tenant read used by the reviewer export route. The
   * tenant context is set in the same transaction as the query so RLS remains
   * a database-level backstop even if a future caller gets filtering wrong.
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
}
