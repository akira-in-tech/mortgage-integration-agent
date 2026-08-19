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
 * Full OIDC/FAPI 2.0 (Section 20 M5's other named target) is not
 * attempted here — this codebase has no external identity provider
 * integration and building a compliant OIDC authorization server from
 * scratch is its own, much larger, separately-scoped effort.
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
