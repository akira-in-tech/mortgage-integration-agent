import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CasePolicySnapshot } from './case-policy-snapshot.entity';

/**
 * Reusable case-to-snapshot binding (Section 10.4, 14.1). A simplified
 * stand-in for the full design: the charter's `CasePolicyBinding` compares
 * an 8-key dependency-generation vector (catalog/jurisdiction/product/
 * program/tenant/lifecycle/source-coverage/resolver) in one bounded
 * indexed query, so a policy activation can invalidate exactly the
 * bindings it affects without re-running full resolution.
 * `observedCatalogGeneration` is this codebase's coarsened, single-key
 * version of that vector (`PolicyCatalogGeneration`) — real
 * generation-based fast-path validation, not per-dependency-key
 * precision. `dependencyDigest` (a content hash of the resolver's
 * output) remains the authority on whether bound *content* actually
 * changed once the slow path runs; the generation only decides whether
 * the slow path runs at all. See `PolicyEvaluationService` and
 * docs/DEVELOPMENT_LOG.md's Known gaps for what this does and doesn't
 * cover.
 *
 * One row per case at a time: a refresh invalidates the prior binding
 * (`invalidatedAt`) rather than deleting it, preserving the audit trail
 * of when a case's policy binding changed and why.
 */
@Entity('case_policy_bindings')
@Index('IDX_case_policy_bindings_case_active', [
  'tenantId',
  'caseId',
  'invalidatedAt',
])
export class CasePolicyBinding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 64 })
  dependencyDigest!: string;

  /** Global `PolicyCatalogGeneration.generation` observed when this binding was created or last refreshed — the fast-path comparison key. */
  @Column({ type: 'integer' })
  observedCatalogGeneration!: number;

  /**
   * `${jurisdictionCode}|${productCode}|${lifecycleEvent}` this binding
   * was resolved for. The fast path must never reuse a binding for a
   * *different* context than the one actually being requested — a
   * generation match alone doesn't guarantee that (a caller can ask
   * about a different jurisdiction for the same case without any catalog
   * change at all).
   */
  @Column({ type: 'varchar', length: 300 })
  contextKey!: string;

  @Column({ type: 'uuid' })
  policySnapshotId!: string;

  @ManyToOne(() => CasePolicySnapshot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policySnapshotId' })
  policySnapshot?: CasePolicySnapshot;

  @CreateDateColumn({ type: 'timestamptz' })
  boundAt!: Date;

  /** Earliest time this binding must be re-validated even if nothing else changed. */
  @Column({ type: 'timestamptz' })
  revalidateAfter!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  invalidatedAt!: Date | null;
}
