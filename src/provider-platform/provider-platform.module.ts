import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderAuthorizationGrant,
      ProviderOperationIntent,
    ]),
  ],
  providers: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
  ],
  exports: [
    ProviderRegistryService,
    ProviderAuthorizationService,
    ProviderOperationIntentService,
  ],
})
export class ProviderPlatformModule {}
