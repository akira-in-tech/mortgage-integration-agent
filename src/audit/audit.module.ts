import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { AuditEventService } from './audit-event.service';
import { AuditEventsController } from './audit-events.controller';

/** `@Global()`, same reasoning as `ConsentModule`/`DataDispositionModule`: consumed from `RoleGuard` (`AuthModule`), `CasesModule`, `WebhooksModule`, and `CommunicationsModule` — module boundaries that don't otherwise relate to each other. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditEventsController],
  providers: [AuditEventService],
  exports: [AuditEventService],
})
export class AuditModule {}
