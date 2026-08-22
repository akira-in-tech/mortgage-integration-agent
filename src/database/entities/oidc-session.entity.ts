import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Server-side OIDC session for the operations console. The browser receives
 * only a high-entropy opaque handle; provider tokens are encrypted as one
 * authenticated bundle and never exposed to JavaScript or persisted in
 * browser storage. This table is global like `users`: tenant authority is
 * still resolved independently from `tenant_memberships` on every request.
 */
@Entity('oidc_sessions')
@Index('UQ_oidc_sessions_token_hash', ['sessionTokenHash'], { unique: true })
@Index('IDX_oidc_sessions_user', ['userId'])
@Index('IDX_oidc_sessions_expires', ['expiresAt'])
export class OidcSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'char', length: 64 })
  sessionTokenHash!: string;

  @Column({ type: 'char', length: 64 })
  csrfTokenHash!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  encryptedTokenBundle!: string;

  @Column({ type: 'timestamptz' })
  accessExpiresAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz' })
  lastUsedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
