import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LegalHoldStatus } from '../enums/legal-hold.enum';

/**
 * Section 14.1's `legal_holds`: "Scoped hold authority, reason, owner,
 * validity, review, and release history." Scoped to a case (matching
 * `data_disposition_tasks`' own scoping), one row per hold rather than
 * an append-only event log — `LegalHoldService.place()` rejects a
 * second `ACTIVE` hold for the same case, so at most one row is ever
 * `ACTIVE` at a time; "release history" is this row's own
 * `releasedAt`/`releasedBy` once it moves to `RELEASED`, not a separate
 * table (the same simplicity tradeoff `ProviderAdapterStatus`, M4-006,
 * made — current-state-only, not full history, is a documented Known
 * gap, not silently accepted).
 *
 * Section 14.2: "legal holds are explicit, scoped, reviewable, and
 * never inferred from an undeletable implementation detail" — this
 * table is the explicit authority `DataDispositionService.resolve()`
 * checks before ever deleting or anonymizing anything; nothing in this
 * codebase infers a hold from any other state.
 */
@Entity('legal_holds')
@Index('IDX_legal_holds_tenant_case', ['tenantId', 'caseId'])
export class LegalHold {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 2000 })
  reason!: string;

  /** Who placed the hold — a human/operator identifier, the same free-text-actor convention `AuditEvent.actorId`/`ConditionTransition.actorId` already use. */
  @Column({ type: 'varchar', length: 200 })
  ownerId!: string;

  @Column({
    type: 'enum',
    enum: LegalHoldStatus,
    default: LegalHoldStatus.ACTIVE,
  })
  status!: LegalHoldStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  placedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  releasedBy!: string | null;
}
