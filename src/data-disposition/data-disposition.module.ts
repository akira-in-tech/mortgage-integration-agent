import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { LegalHold } from '../database/entities/legal-hold.entity';
import { DataDispositionService } from './data-disposition.service';
import { LegalHoldService } from './legal-hold.service';
import { DataDispositionController } from './data-disposition.controller';

/**
 * `@Global()`, same reasoning as `ConsentModule`: `DataDispositionService`
 * is consumed from `ConsentModule` (revocation opens a review) across a
 * module boundary. `DataDispositionController` is this module's first
 * real read/write surface (REST) — the reviewer queue predicted in the
 * comment above.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DataDispositionTask, LegalHold])],
  controllers: [DataDispositionController],
  providers: [DataDispositionService, LegalHoldService],
  exports: [DataDispositionService, LegalHoldService],
})
export class DataDispositionModule {}
