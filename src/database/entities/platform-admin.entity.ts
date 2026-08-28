import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { PlatformAdminStatus } from '../enums/platform-admin.enum';

/**
 * A bearer credential (`{id}.{secret}`, same shape and hashing as
 * `ApiClient`) that is not scoped to any tenant — deliberately: it exists
 * only to drive Section 11.4's provider promotion chain
 * (`ProviderPromotionService`), which manages providers shared identically
 * across every tenant (see `ProviderPromotionManifest`'s own "NOT
 * tenant-scoped" comment). Reusing `ApiClient` for this would have meant
 * either forcing a fake tenantId onto a decision that has none, or letting
 * any single tenant's own REVIEWER credential reach across every other
 * tenant — a real cross-tenant privilege escalation, not just an awkward
 * fit. This table is the honest fix: its own credential type, checked by
 * its own guard (`PlatformAdminGuard`), never accepted by `TenantAuthGuard`.
 *
 * No RLS — like `provider_promotion_manifests` itself, there is no tenant
 * dimension here to isolate.
 */
@Entity('platform_admins')
export class PlatformAdmin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200 })
  hashedSecret!: string;

  @Column({
    type: 'enum',
    enum: PlatformAdminStatus,
    default: PlatformAdminStatus.ACTIVE,
  })
  status!: PlatformAdminStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
