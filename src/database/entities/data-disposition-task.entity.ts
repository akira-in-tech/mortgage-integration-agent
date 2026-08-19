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
} from '../enums/data-disposition.enum';

/**
 * Section 14.1's `data_disposition_tasks`. `affectedEvidenceFactIds` is
 * the lineage reference Section 14.2 asks for ("retention... traverses
 * document, evidence, normalized finding... lineage") — a snapshot of
 * which `evidence_facts` rows existed for the case at the moment the task
 * opened, not a live query; a document/normalized-finding/cache/search-
 * index/backup lineage doesn't exist yet for any of those concepts to
 * traverse (Known gap — this codebase has none of those subsystems).
 * `resolvedAt` stays always-null: nothing in this codebase advances a
 * task past `PENDING` yet (see the enum's own comment).
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
