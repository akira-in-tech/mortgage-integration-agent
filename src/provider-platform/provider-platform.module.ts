import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderAuthorizationGrant,
      ProviderOperationIntent,
      ProviderAdapterStatus,
    ]),
  ],
  providers: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
    ProviderKillSwitchService,
  ],
  exports: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
    ProviderKillSwitchService,
  ],
})
export class ProviderPlatformModule {}
