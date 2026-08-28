import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Section 10.4's dependency-generation fast path, coarsened to a single
 * global counter rather than the target 8-key vector (catalog/
 * jurisdiction/product/program/tenant/lifecycle/source-coverage/
 * resolver) — a real, honest simplification: it can only ever
 * over-invalidate (a Texas policy change bumps the generation that a New
 * York case's binding also compares against, forcing an unnecessary
 * slow-path re-resolution), never under-invalidate, so correctness holds
 * even though precision doesn't. See `PolicyActivationService` (what
 * bumps this) and `PolicyEvaluationService` (what reads it).
 *
 * A single row, enforced by a fixed primary key rather than a genuine
 * singleton constraint — simpler than a boolean-PK/check-constraint
 * pattern for a table nothing but this fast path ever queries.
 */
@Entity('policy_catalog_generation')
export class PolicyCatalogGeneration {
  @PrimaryColumn({ type: 'integer', default: 1 })
  id!: number;

  @Column({ type: 'integer', default: 0 })
  generation!: number;
}
