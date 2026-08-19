import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { ConsentService } from './consent.service';

/**
 * `@Global()`, same reasoning as `AuthModule`: `ConsentService` is
 * consumed across module boundaries that don't otherwise relate to each
 * other — `CasesModule` (grant at creation, the new revoke endpoint),
 * `ProviderPlatformModule` (attaching/revalidating consent record ids on
 * a grant), and the Temporal `WorkerModule` (`evaluateConditions` reading
 * real status). `ConsentRecord`'s `TypeOrmModule.forFeature` is also
 * registered directly inside each of those modules — the same empirically
 * necessary redundancy M5-001's own dev log entry found for `AuthModule`/
 * `ApiClient` (the testing injector, not the production bootstrapper,
 * fails to resolve it through `@Global()` alone).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord])],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
