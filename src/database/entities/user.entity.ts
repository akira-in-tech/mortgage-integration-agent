import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Section 14.1's `users`: "OIDC-linked human identity" (M5-024). Global,
 * not tenant-scoped — a person's identity exists independently of which
 * tenant(s) they can act within; `TenantMembership` is what grants
 * per-tenant access. `subject` is the OIDC `sub` claim from this
 * codebase's own configured issuer (`OIDC_ISSUER_URL`) — this codebase
 * integrates with exactly one real issuer at a time (self-hosted
 * Keycloak locally), so a plain unique `subject` is honest; a
 * multi-issuer deployment would need `(issuer, subject)` uniqueness
 * instead, not built since only one issuer is ever configured.
 *
 * No REST endpoint creates a `User` row — the same honest administrative-
 * action gap `create-api-client.ts` already has (`npm run manage-user --
 * create-user ...`, M5-024).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  subject!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
