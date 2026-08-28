import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationReportRecord } from '../database/entities/evaluation-report-record.entity';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { EvaluationReportRecordService } from './evaluation-report-record.service';
import { EvaluationReportController } from './evaluation-report.controller';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';

/**
 * `PlatformAdmin` is registered locally here rather than relying on the
 * shared `@Global()` `AuthModule` — matches `ProviderPlatformModule`'s
 * own precedent (M7-020's dev log entry has the full story): a
 * `@UseGuards()`-referenced class whose own constructor dependency
 * isn't also reachable from the consuming module's local scope failed
 * to resolve when this codebase tried the global-only approach, so
 * every module using `PlatformAdminGuard` gives it its own local
 * repository instead of trusting cross-module resolution to work.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EvaluationReportRecord, PlatformAdmin])],
  controllers: [EvaluationReportController],
  providers: [EvaluationReportRecordService, PlatformAdminGuard],
  exports: [EvaluationReportRecordService],
})
export class EvaluationReportsModule {}
