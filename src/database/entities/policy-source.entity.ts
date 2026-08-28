import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Jurisdiction } from './jurisdiction.entity';
import { PolicySourceRetrievalMode } from '../enums/policy-source.enum';

/**
 * Authorized source registry (Section 10.1, 10.2, 14.1). Not itself
 * policy content — a `PolicySource` is the accountable, jurisdiction-
 * scoped origin that `PolicySourceRevision` rows are retrieved from and
 * that `PolicyVersion` rows ultimately trace provenance back to.
 */
@Entity('policy_sources')
export class PolicySource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Accountable owner (team or role), not a user FK — no user model exists yet. */
  @Column({ type: 'varchar', length: 200 })
  owner!: string;

  @Column({ type: 'varchar', length: 20 })
  jurisdictionCode!: string;

  @ManyToOne(() => Jurisdiction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jurisdictionCode' })
  jurisdiction?: Jurisdiction;

  @Column({ type: 'enum', enum: PolicySourceRetrievalMode })
  retrievalMode!: PolicySourceRetrievalMode;

  /** Section 10.1: "freshness objective". */
  @Column({ type: 'int' })
  freshnessObjectiveHours!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
