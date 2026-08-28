import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../enums/jurisdiction.enum';

/**
 * Stable jurisdiction catalog (Section 10.1, 14.1). `code` is the primary
 * key rather than a generated uuid — jurisdiction codes (e.g. "US",
 * "US-CA") are the stable, human-meaningful identifiers every policy
 * record's applicability metadata references, and are never expected to
 * change once assigned.
 */
@Entity('jurisdictions')
export class Jurisdiction {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'enum', enum: JurisdictionLevel })
  level!: JurisdictionLevel;

  @Column({ type: 'varchar', length: 20, nullable: true })
  parentCode!: string | null;

  @ManyToOne(() => Jurisdiction, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentCode' })
  parent?: Jurisdiction | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Explicit, reviewed fact — never an implicit default (Section 10.6). */
  @Column({
    type: 'enum',
    enum: JurisdictionCoverageStatus,
    default: JurisdictionCoverageStatus.NOT_COVERED,
  })
  coverageStatus!: JurisdictionCoverageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
