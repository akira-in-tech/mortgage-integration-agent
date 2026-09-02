import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import {
  DataDispositionTaskStatus,
  DataDispositionTaskType,
  DataDispositionResolutionOutcome,
} from '../database/enums/data-disposition.enum';
import { runInTenantContext } from '../database/tenant-context';
import { LegalHoldService } from './legal-hold.service';
import { AuditEventService } from '../audit/audit-event.service';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentStatus } from '../database/enums/provider-platform.enum';

export interface OpenRetentionReviewParams {
  tenantId: string;
  caseId: string;
  consentRecordId: string;
}

export type DataDispositionResolutionAction = 'DELETE' | 'ANONYMIZE' | 'RETAIN';

/**
 * Section 14.2: "Consent revocation... opens a data-disposition review
 * for evidence already collected under that consent" — the one real
 * trigger this codebase drives. `resolve()` (M5-025) is the first real
 * thing that acts on an opened task: deletes or anonymizes the
 * referenced `evidence_facts`, or records that they were retained under
 * an active legal hold — see that method's own comment.
 */
@Injectable()
export class DataDispositionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly legalHoldService: LegalHoldService,
    private readonly auditEventService: AuditEventService,
  ) {}

  /**
   * Called from within `ConsentService.revoke()`'s own transaction (the
   * same `manager`, already tenant-scoped) so a revocation can never
   * commit without also opening its required review — not a separate
   * `runInTenantContext` call of its own, which would leave a window
   * where the two could diverge if the process crashed between them.
   */
  async openRetentionReviewForRevokedConsent(
    manager: EntityManager,
    params: OpenRetentionReviewParams,
  ): Promise<DataDispositionTask> {
    const affectedEvidence = await manager.getRepository(EvidenceFact).find({
      where: { tenantId: params.tenantId, caseId: params.caseId },
    });
    const affectedEvidenceFactIds = affectedEvidence.map((e) => e.id);
    const affectedProviderIntents: Array<{ id: string }> = await manager.query(
      `SELECT "id" FROM "provider_operation_intents" WHERE "tenantId" = $1 AND "caseId" = $2`,
      [params.tenantId, params.caseId],
    );
    const affectedProviderIntentIds = affectedProviderIntents.map(
      (intent) => intent.id,
    );

    const repo = manager.getRepository(DataDispositionTask);
    return repo.save(
      repo.create({
        tenantId: params.tenantId,
        caseId: params.caseId,
        taskType: DataDispositionTaskType.RETENTION_REVIEW,
        status: DataDispositionTaskStatus.PENDING,
        reason: `Consent ${params.consentRecordId} was revoked for case ${params.caseId}; ${affectedEvidenceFactIds.length} evidence record(s) and ${affectedProviderIntentIds.length} provider result(s) require retention review.`,
        triggeringConsentRecordId: params.consentRecordId,
        affectedEvidenceFactIds,
        affectedProviderIntentIds,
        resolvedAt: null,
        backupExpiryDueAt: null,
        backupExpiryVerifiedAt: null,
        backupVerificationReference: null,
      }),
    );
  }

  async listForCase(
    tenantId: string,
    caseId: string,
  ): Promise<DataDispositionTask[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(DataDispositionTask).find({
        where: { tenantId, caseId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  /**
   * The first real thing that ever advances a task past `PENDING`
   * (M5-025). `RETAIN` requires an active legal hold to be a genuine,
   * explainable reason — this codebase has no other real retention
   * basis to express (Section 14.2: "retained under a valid hold").
   * `DELETE`/`ANONYMIZE` both fail closed if a hold is active — checked
   * fresh on every call, never inferred or cached, matching
   * `LegalHoldService`'s own "explicit... never inferred" requirement.
   * `RETAIN` reaches VERIFIED immediately. DELETE/ANONYMIZE stop at
   * COMPLETED until the authoritative backup-retention window is separately
   * attested by `verifyBackupExpiry()`.
   *
   * The audit-event write used to live in `DataDispositionController`
   * only (M7-028 fix): `resolve-data-disposition-task.ts` calls this
   * method directly and never went through the controller, so a
   * script-driven resolution produced no `audit_events` row while a
   * REST-driven one did — the same mutation, two different provenance
   * outcomes depending on who called it. Moving the write here closes
   * that gap for both callers at once.
   */
  async resolve(
    tenantId: string,
    taskId: string,
    action: DataDispositionResolutionAction,
    actorId: string,
    correlationId?: string | null,
  ): Promise<DataDispositionTask> {
    const resolved = await runInTenantContext(
      this.dataSource,
      tenantId,
      async (manager) => {
        const taskRepo = manager.getRepository(DataDispositionTask);
        const task = await taskRepo.findOneBy({ id: taskId, tenantId });
        if (!task) {
          throw new BadRequestException(
            `data disposition task ${taskId} not found`,
          );
        }
        if (task.status !== DataDispositionTaskStatus.PENDING) {
          throw new BadRequestException(
            `data disposition task ${taskId} is already ${task.status}`,
          );
        }

        const hasHold = await this.legalHoldService.hasActiveHold(
          tenantId,
          task.caseId,
        );

        if (action === 'RETAIN') {
          if (!hasHold) {
            throw new BadRequestException(
              `cannot RETAIN task ${taskId} — case ${task.caseId} has no active legal hold to retain it under; place one first, or choose DELETE/ANONYMIZE`,
            );
          }
        } else if (hasHold) {
          throw new BadRequestException(
            `cannot ${action} task ${taskId} — case ${task.caseId} has an active legal hold; release it first, or choose RETAIN`,
          );
        }

        const evidenceRepo = manager.getRepository(EvidenceFact);
        let resolutionOutcome: DataDispositionResolutionOutcome;
        let status = DataDispositionTaskStatus.VERIFIED;
        let backupExpiryDueAt: Date | null = null;

        // Lock every snapshotted provider intent before deleting derived
        // payloads. A dispatched/ambiguous operation may still write a result;
        // deletion must wait for reconciliation instead of racing that write.
        // PREPARED is safe to cancel because no external submission occurred.
        const providerIntents =
          task.affectedProviderIntentIds.length === 0
            ? []
            : await manager
                .getRepository(ProviderOperationIntent)
                .createQueryBuilder('intent')
                .setLock('pessimistic_write')
                .where('intent."tenantId" = :tenantId', { tenantId })
                .andWhere('intent.id IN (:...ids)', {
                  ids: task.affectedProviderIntentIds,
                })
                .getMany();
        const unsettled = providerIntents.filter((intent) =>
          [
            ProviderOperationIntentStatus.DISPATCHED,
            ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
            ProviderOperationIntentStatus.RECONCILING,
          ].includes(intent.state),
        );
        if (action !== 'RETAIN' && unsettled.length > 0) {
          throw new BadRequestException(
            `cannot ${action} task ${taskId} — ${unsettled.length} provider operation(s) still require outcome reconciliation`,
          );
        }
        const preparedIds = providerIntents
          .filter(
            (intent) => intent.state === ProviderOperationIntentStatus.PREPARED,
          )
          .map((intent) => intent.id);
        if (action !== 'RETAIN' && preparedIds.length > 0) {
          await manager
            .getRepository(ProviderOperationIntent)
            .createQueryBuilder()
            .update()
            .set({
              state: ProviderOperationIntentStatus.CANCELLED,
              resolvedBy: actorId,
              resolutionNote:
                'Cancelled before dispatch during consent-revocation data disposition.',
            })
            .where('id IN (:...ids)', { ids: preparedIds })
            .andWhere('state = :state', {
              state: ProviderOperationIntentStatus.PREPARED,
            })
            .execute();
        }

        if (action === 'DELETE') {
          if (task.affectedEvidenceFactIds.length > 0) {
            await evidenceRepo.delete(task.affectedEvidenceFactIds);
          }
          resolutionOutcome = DataDispositionResolutionOutcome.DELETED;
        } else if (action === 'ANONYMIZE') {
          if (task.affectedEvidenceFactIds.length > 0) {
            await evidenceRepo
              .createQueryBuilder()
              .update()
              .set({ value: {} })
              .whereInIds(task.affectedEvidenceFactIds)
              .execute();
          }
          resolutionOutcome = DataDispositionResolutionOutcome.ANONYMIZED;
        } else {
          resolutionOutcome =
            DataDispositionResolutionOutcome.RETAINED_UNDER_HOLD;
        }

        if (action !== 'RETAIN') {
          if (task.affectedProviderIntentIds.length > 0) {
            await manager.query(
              `UPDATE "provider_operation_intents"
               SET "providerReceipt" = NULL, "normalizedFinding" = NULL, "updatedAt" = now()
               WHERE "tenantId" = $1 AND "id" = ANY($2::uuid[])`,
              [tenantId, task.affectedProviderIntentIds],
            );
          }
          status = DataDispositionTaskStatus.COMPLETED;
          const retentionHours = Number(
            process.env.BACKUP_RETENTION_HOURS ?? '24',
          );
          backupExpiryDueAt = new Date(
            Date.now() + retentionHours * 60 * 60 * 1000,
          );
        }

        await taskRepo.update(
          { id: taskId },
          {
            status,
            resolutionOutcome,
            resolvedAt: new Date(),
            resolvedBy: actorId,
            backupExpiryDueAt,
          },
        );
        return taskRepo.findOneByOrFail({ id: taskId });
      },
    );

    await this.auditEventService.record({
      tenantId,
      actorId,
      action: 'DATA_DISPOSITION_TASK_RESOLVED',
      resourceType: 'data_disposition_task',
      resourceId: taskId,
      correlationId: correlationId ?? null,
      reason: `Resolved as ${action}`,
      metadata: { action },
    });
    return resolved;
  }

  /**
   * Final verification after the authoritative backup-retention window. The
   * evidence reference identifies an operator/drill record and must never
   * contain deleted borrower content.
   */
  async verifyBackupExpiry(
    tenantId: string,
    taskId: string,
    actorId: string,
    verificationReference: string,
    now = new Date(),
  ): Promise<DataDispositionTask> {
    if (!verificationReference.trim()) {
      throw new BadRequestException(
        'backup verification reference is required',
      );
    }
    const verified = await runInTenantContext(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repo = manager.getRepository(DataDispositionTask);
        const task = await repo.findOneBy({ id: taskId, tenantId });
        if (!task || task.status !== DataDispositionTaskStatus.COMPLETED) {
          throw new BadRequestException(
            `data disposition task ${taskId} is not awaiting backup expiry`,
          );
        }
        if (!task.backupExpiryDueAt || task.backupExpiryDueAt > now) {
          throw new BadRequestException(
            `backup retention window for task ${taskId} has not expired`,
          );
        }
        if (await this.legalHoldService.hasActiveHold(tenantId, task.caseId)) {
          throw new BadRequestException(
            `cannot verify backup expiry for task ${taskId} while a legal hold is active`,
          );
        }
        await repo.update(
          { id: taskId, status: DataDispositionTaskStatus.COMPLETED },
          {
            status: DataDispositionTaskStatus.VERIFIED,
            backupExpiryVerifiedAt: now,
            backupVerificationReference: verificationReference,
          },
        );
        return repo.findOneByOrFail({ id: taskId });
      },
    );
    await this.auditEventService.record({
      tenantId,
      actorId,
      action: 'DATA_DISPOSITION_BACKUP_EXPIRY_VERIFIED',
      resourceType: 'data_disposition_task',
      resourceId: taskId,
      correlationId: null,
      reason: 'Verified managed-backup retention expiry',
      metadata: { verificationReference },
    });
    return verified;
  }

  async listAwaitingBackupExpiry(
    tenantId: string,
    limit = 50,
  ): Promise<DataDispositionTask[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(DataDispositionTask).find({
        where: { tenantId, status: DataDispositionTaskStatus.COMPLETED },
        order: { backupExpiryDueAt: 'ASC' },
        take: boundedLimit,
      }),
    );
  }

  /**
   * Every task still waiting on a decision (status PENDING), across
   * every case, oldest first — the list a reviewer works through.
   */
  async listOpen(tenantId: string, limit = 50): Promise<DataDispositionTask[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(DataDispositionTask).find({
        where: { tenantId, status: DataDispositionTaskStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: boundedLimit,
      }),
    );
  }
}
