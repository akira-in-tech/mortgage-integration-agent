import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ProviderPromotionManifest } from '../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../database/entities/provider-activation.entity';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderPromotionService } from './provider-promotion.service';
import { ProviderReconciliationService } from './provider-reconciliation.service';

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
    ]),
  ],
  providers: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
    ProviderKillSwitchService,
    ProviderPromotionService,
    ProviderReconciliationService,
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
