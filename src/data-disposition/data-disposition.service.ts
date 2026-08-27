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

    const repo = manager.getRepository(DataDispositionTask);
    return repo.save(
      repo.create({
        tenantId: params.tenantId,
        caseId: params.caseId,
        taskType: DataDispositionTaskType.RETENTION_REVIEW,
        status: DataDispositionTaskStatus.PENDING,
        reason: `Consent ${params.consentRecordId} was revoked for case ${params.caseId}; ${affectedEvidenceFactIds.length} evidence record(s) collected under that consent require retention review.`,
        triggeringConsentRecordId: params.consentRecordId,
        affectedEvidenceFactIds,
        resolvedAt: null,
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
   * `PENDING` -> `VERIFIED` directly, one atomic transaction — see
   * `DataDispositionTaskStatus`'s own comment for why no distinct
   * `IN_PROGRESS`/`COMPLETED` interval is modeled.
   */
  async resolve(
    tenantId: string,
    taskId: string,
    action: DataDispositionResolutionAction,
    actorId: string,
  ): Promise<DataDispositionTask> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
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

      await taskRepo.update(
        { id: taskId },
        {
          status: DataDispositionTaskStatus.VERIFIED,
          resolutionOutcome,
          resolvedAt: new Date(),
          resolvedBy: actorId,
        },
      );
      return taskRepo.findOneByOrFail({ id: taskId });
    });
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
