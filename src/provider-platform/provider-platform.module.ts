import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ProviderPromotionManifest } from '../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../database/entities/provider-activation.entity';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderPromotionService } from './provider-promotion.service';
import { ProviderReconciliationService } from './provider-reconciliation.service';
import { ProviderOperationIntentController } from './provider-operation-intent.controller';
import { ProviderPromotionController } from './provider-promotion.controller';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PlatformAdminService } from '../auth/platform-admin.service';

/**
 * `PlatformAdmin` is registered here, not in the (tenant-scoped)
 * `AuthModule` — `PlatformAdminGuard` has exactly one consumer
 * (`ProviderPromotionController`, right here), and giving it its own
 * local repository avoids relying on cross-module provider resolution
 * for a `@UseGuards()`-referenced class, which this codebase's
 * `TenantAuthGuard`/`RoleGuard` pattern gets "for free" from
 * `AuthModule`'s `@Global()` only because every route that needs them
 * shares that exact module reachability path already — a path this
 * guard, defined in `src/auth/` but used only from provider-platform
 * routes, doesn't have the same guarantee on.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderAuthorizationGrant,
      ProviderOperationIntent,
      ProviderAdapterStatus,
      ProviderPromotionManifest,
      ProviderCertificationRecord,
      ProviderApprovalRecord,
      ProviderActivation,
      PlatformAdmin,
    ]),
  ],
  controllers: [ProviderOperationIntentController, ProviderPromotionController],
  providers: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
    ProviderKillSwitchService,
    ProviderPromotionService,
    ProviderReconciliationService,
    PlatformAdminGuard,
    PlatformAdminService,
  ],
  exports: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
    ProviderKillSwitchService,
    ProviderPromotionService,
    ProviderReconciliationService,
  ],
})
export class ProviderPlatformModule {}
