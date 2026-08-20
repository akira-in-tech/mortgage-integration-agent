import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiClientRole, ApiClientStatus } from '../enums/api-client.enum';

/**
 * Section 20 M5's "scoped API-client authentication" — the first, honest
 * slice of it: a bearer credential (`{id}.{secret}`) bound to exactly one
 * tenant, checked by `ApiKeyGuard` on every partner-API request.
 * `hashedSecret` is a salted scrypt digest (`{salt}:{digest}`, both hex) —
 * the raw secret is generated once, returned exactly once in the creation
 * response/CLI output, and never stored or re-derivable from this row.
 * Section 20 M5's other named target — real OIDC for human identity —
 * is `User`/`TenantMembership` (M5-024): a deliberately separate
 * credential model, not a variant of this one. This codebase never
 * implements its own OIDC *authorization server* (an out-of-scope, much
 * larger effort) — `OidcGuard` is a real *relying party* against a real,
 * self-hosted issuer (Keycloak, this codebase's own docker-compose.yml).
 */
@Entity('api_clients')
@Index('IDX_api_clients_tenant', ['tenantId'])
export class ApiClient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200 })
  hashedSecret!: string;

  @Column({
    type: 'enum',
    enum: ApiClientStatus,
    default: ApiClientStatus.ACTIVE,
  })
  status!: ApiClientStatus;

  /** M5-017's scoped RBAC — see `ApiClientRole`'s own comment for the two-role rationale. */
  @Column({
    type: 'enum',
    enum: ApiClientRole,
    default: ApiClientRole.PARTNER,
  })
  role!: ApiClientRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
