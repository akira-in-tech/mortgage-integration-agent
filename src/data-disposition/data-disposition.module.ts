import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { DataDispositionService } from './data-disposition.service';

/**
 * `@Global()`, same reasoning as `ConsentModule`: `DataDispositionService`
 * is consumed from `ConsentModule` (revocation opens a review) across a
 * module boundary, and will be needed from wherever a future data-
 * disposition read surface (GraphQL/REST) lands too.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DataDispositionTask])],
  providers: [DataDispositionService],
  exports: [DataDispositionService],
})
export class DataDispositionModule {}
