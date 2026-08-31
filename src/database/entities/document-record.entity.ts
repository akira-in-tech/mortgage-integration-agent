import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LoanCase } from './loan-case.entity';

/**
 * Metadata and lineage for one encrypted document object. The storage key is
 * random and opaque; filenames, plaintext, and extraction output do not live
 * here. A future upload transaction must create this record before making the
 * ciphertext reachable, and disposition must use it to address the object.
 */
@Entity('document_records')
@Index('IDX_document_records_tenant_case', ['tenantId', 'caseId'])
@Index('UQ_document_records_storage_key', ['storageKey'], { unique: true })
export class DocumentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @ManyToOne(() => LoanCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case?: LoanCase;

  @Column({ type: 'varchar', length: 300 })
  storageKey!: string;

  @Column({ type: 'char', length: 64 })
  contentHash!: string;

  @Column({ type: 'varchar', length: 255 })
  mediaType!: string;

  @Column({ type: 'integer' })
  byteSize!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
