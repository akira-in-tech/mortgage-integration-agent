import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { ApiClient } from '../database/entities/api-client.entity';
import { CommunicationMessageService } from './communication-message.service';
import { CommunicationApprovalService } from './communication-approval.service';
import { CommunicationDeliverySimulator } from './communication-delivery-simulator';
import { CommunicationDeliveryService } from './communication-delivery.service';
import { CommunicationMessagesController } from './communication-messages.controller';
import { CommunicationMessagesResolver } from './communication-messages.resolver';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunicationTemplate,
      CommunicationMessage,
      CommunicationApproval,
      // `ApiKeyGuard`/`RoleGuard` (used via `@UseGuards(...)` class
      // references on the new controller below, M5-022) resolve their own
      // dependencies scoped to this module's own injector, not just
      // AuthModule's — CasesModule/WebhooksModule carry this exact same
      // ApiClient registration for the identical reason.
      ApiClient,
    ]),
    AuditModule,
  ],
  controllers: [CommunicationMessagesController],
  providers: [
    CommunicationMessageService,
    CommunicationApprovalService,
    CommunicationDeliverySimulator,
    CommunicationDeliveryService,
    CommunicationMessagesResolver,
  ],
  exports: [
    CommunicationMessageService,
    CommunicationApprovalService,
    CommunicationDeliverySimulator,
    CommunicationDeliveryService,
  ],
})
export class CommunicationsModule {}
