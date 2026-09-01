import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Short-lived, server-side credentials for the public portfolio sandbox.
 * Browser JavaScript receives only the opaque cookie handle and a CSRF value;
 * tenant/actor authority remains server-side and cannot be selected by a
 * visitor. Expiry invalidates access even if an old browser retains cookies.
 */
@Entity('guest_sandbox_sessions')
@Index('UQ_guest_sandbox_sessions_token_hash', ['sessionTokenHash'], {
  unique: true,
})
@Index('IDX_guest_sandbox_sessions_expires', ['expiresAt'])
export class GuestSandboxSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'char', length: 64 })
  sessionTokenHash!: string;

  @Column({ type: 'char', length: 64 })
  csrfTokenHash!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz' })
  lastUsedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
