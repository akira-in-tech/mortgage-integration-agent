import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProviderCertificationDecision } from '../enums/provider-promotion.enum';

/**
 * Section 11.4's `ProviderCertificationRecord`: an append-only test report
 * against one manifest. Never updated after insert — a later re-run (e.g.
 * PASSED expires and gets re-certified, or a certification is revoked) is
 * a new row, not a mutation; `ProviderPromotionService` always reads the
 * latest row per `{manifestId, environment}` to answer "is this manifest
 * currently certified."
 *
 * No FK constraint to the manifest table — matches this codebase's
 * existing convention of plain `uuid` reference columns without a
 * declared TypeORM relation (e.g. `PolicyTransitionApproval.policyVersionId`).
 */
@Entity('provider_certification_records')
@Index('IDX_provider_certification_records_manifest', [
  'manifestId',
  'environment',
])
export class ProviderCertificationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  manifestId!: string;

  /** e.g. "sandbox", "staging" — free-text, this codebase has no persisted environment enum. */
  @Column({ type: 'varchar', length: 50 })
  environment!: string;

  @Column({ type: 'varchar', length: 200 })
  certifiedBy!: string;

  @Column({ type: 'enum', enum: ProviderCertificationDecision })
  decision!: ProviderCertificationDecision;

  @Column({ type: 'varchar', length: 2000 })
  evidenceRef!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  decidedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
