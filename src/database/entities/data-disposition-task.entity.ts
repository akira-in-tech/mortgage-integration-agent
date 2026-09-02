import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  DataDispositionTaskStatus,
  DataDispositionTaskType,
  DataDispositionResolutionOutcome,
} from '../enums/data-disposition.enum';

/**
 * Section 14.1's `data_disposition_tasks`. `affectedEvidenceFactIds` is
 * the lineage reference Section 14.2 asks for ("retention... traverses
 * document, evidence, normalized finding... lineage") — snapshots of
 * evidence and provider-intent rows at task creation. Backup expiry is
 * tracked separately because removing primary ciphertext does not erase an
 * already-created managed database backup.
 *
 * `resolutionOutcome`/`resolvedBy` (M5-025) are the real "deletion
 * verification records what was deleted, anonymized, [or] retained
 * under a valid hold" Section 14.2 requires — populated by
 * `DataDispositionService.resolve()`, the first real thing that ever
 * advances a task past `PENDING`.
 */
@Entity('data_disposition_tasks')
@Index('IDX_data_disposition_tasks_tenant_case', ['tenantId', 'caseId'])
export class DataDispositionTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'enum', enum: DataDispositionTaskType })
  taskType!: DataDispositionTaskType;

  @Column({
    type: 'enum',
    enum: DataDispositionTaskStatus,
    default: DataDispositionTaskStatus.PENDING,
  })
  status!: DataDispositionTaskStatus;

  @Column({ type: 'varchar', length: 2000 })
  reason!: string;

  /** Null once a second real trigger exists — this slice's only one is consent revocation. */
  @Column({ type: 'uuid', nullable: true })
  triggeringConsentRecordId!: string | null;

  @Column({ type: 'jsonb' })
  affectedEvidenceFactIds!: string[];

  @Column({ type: 'jsonb' })
  affectedProviderIntentIds!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({
    type: 'enum',
    enum: DataDispositionResolutionOutcome,
    nullable: true,
  })
  resolutionOutcome!: DataDispositionResolutionOutcome | null;

  @Column({ type: 'timestamptz', nullable: true })
  backupExpiryDueAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  backupExpiryVerifiedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  backupVerificationReference!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  resolvedBy!: string | null;
}
