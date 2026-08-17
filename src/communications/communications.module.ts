import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { CommunicationMessageService } from './communication-message.service';
import { CommunicationApprovalService } from './communication-approval.service';
import { CommunicationDeliverySimulator } from './communication-delivery-simulator';
import { CommunicationDeliveryService } from './communication-delivery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunicationTemplate,
      CommunicationMessage,
      CommunicationApproval,
    ]),
  ],
  providers: [
    CommunicationMessageService,
    CommunicationApprovalService,
    CommunicationDeliverySimulator,
    CommunicationDeliveryService,
  ],
  exports: [
    CommunicationMessageService,
    CommunicationApprovalService,
    CommunicationDeliverySimulator,
    CommunicationDeliveryService,
  ],
})
export class CommunicationsModule {}
