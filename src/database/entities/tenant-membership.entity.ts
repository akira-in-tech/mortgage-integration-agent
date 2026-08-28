import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { ApiClientRole } from '../enums/api-client.enum';

/**
 * Section 14.1's `tenant_memberships`: "Role assignment by tenant"
 * (M5-024) — an OIDC-linked `User`'s real, current access to one tenant.
 * One row per `(tenantId, userId)`, current-state-only: `role` is
 * updated in place by a re-grant, a revoke deletes the row outright —
 * the same simplicity tradeoff `ProviderAdapterStatus` made, appropriate
 * here since a membership is a live grant, not itself a security-history
 * fact (`audit_events` is where a grant/revoke's own history belongs, if
 * this codebase's admin scripts ever gain the actor context to write one).
 *
 * NOT RLS-protected, deliberately — the identical bootstrap reasoning
 * `api_clients` itself already has (no RLS, see that entity's own
 * comment): `OidcGuard` looks this row up using a caller-supplied,
 * not-yet-trusted `tenantId` (the `X-Tenant-Id` header) specifically to
 * determine whether the request is allowed to act in that tenant at all
 * — tenant context cannot already be established before that lookup
 * runs, so RLS could never apply to it anyway.
 */
@Entity('tenant_memberships')
@Unique('UQ_tenant_memberships_tenant_user', ['tenantId', 'userId'])
export class TenantMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  /** Shared with `ApiClient.role` — see `ApiClientRole`'s own comment for why one role vocabulary serves both credential models. */
  @Column({ type: 'enum', enum: ApiClientRole })
  role!: ApiClientRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
