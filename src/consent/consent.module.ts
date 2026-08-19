import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { ConsentService } from './consent.service';
import { DataDispositionModule } from '../data-disposition/data-disposition.module';

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
 *
 * Imports `DataDispositionModule` (M5-015): `revoke()` now opens a
 * retention-review task in the same transaction, per Section 14.2.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord]), DataDispositionModule],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
