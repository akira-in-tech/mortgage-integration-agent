import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { ApiClient } from '../database/entities/api-client.entity';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEndpoint,
      WebhookDelivery,
      OutboxEvent,
      ApiClient,
    ]),
  ],
  controllers: [WebhookEndpointsController, WebhookDeliveriesController],
  providers: [
    WebhookEndpointService,
    WebhookDeliveryService,
    WebhookDispatchService,
  ],
  exports: [WebhookDispatchService],
})
export class WebhooksModule {}
