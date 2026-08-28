import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Transactional outbox (Section 12.2, 14.1, M2 scope: "transactional outbox
 * and signed status event foundation"). Written in the same database
 * transaction as the domain state change it describes (Section 9.5:
 * "COMMIT STATE AND OUTBOX EVENT"), so a committed domain change can never
 * exist without its corresponding event, and vice versa. `publishedAt`
 * stays null in this slice — there is no dispatcher yet; that, along with
 * `webhook_endpoints`/`webhook_deliveries`, is M4 scope. This table is the
 * foundation M4's dispatcher will read from, not the delivery mechanism
 * itself.
 */
@Entity('outbox_events')
@Index('IDX_outbox_events_tenant_case', ['tenantId', 'caseId'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  /** Event catalog member, e.g. "loan_case.created" (Section 15.4). */
  @Column({ type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  /**
   * HMAC-SHA256 hex digest over a canonicalized (recursively key-sorted)
   * serialization of `payload` (Section 15.3: "timestamped HMAC ...
   * signatures"). Canonicalized specifically because Postgres jsonb does
   * not preserve object key order, so a naive JSON.stringify of a value
   * read back from this column would not reliably reproduce the exact
   * string signed at write time — see outbox-signer.ts.
   */
  @Column({ type: 'varchar', length: 64 })
  signature!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
