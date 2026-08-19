import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import {
  DataDispositionTaskStatus,
  DataDispositionTaskType,
} from '../database/enums/data-disposition.enum';
import { runInTenantContext } from '../database/tenant-context';

export interface OpenRetentionReviewParams {
  tenantId: string;
  caseId: string;
  consentRecordId: string;
}

/**
 * Section 14.2: "Consent revocation... opens a data-disposition review
 * for evidence already collected under that consent" — the one real
 * trigger this codebase drives (Known gap otherwise: no deletion,
 * anonymization, legal-hold, or verification workflow acts on a task
 * once opened).
 */
@Injectable()
export class DataDispositionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
}
