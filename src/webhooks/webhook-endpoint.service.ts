import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookEndpointStatus } from '../database/enums/webhook.enum';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';

@Injectable()
export class WebhookEndpointService {
  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpointRepository: Repository<WebhookEndpoint>,
  ) {}

  async create(
    tenantId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    return this.endpointRepository.save(
      this.endpointRepository.create({
        tenantId,
        targetUrl: dto.targetUrl,
        eventTypes: dto.eventTypes,
        secret: randomBytes(32).toString('hex'),
        status: WebhookEndpointStatus.ACTIVE,
      }),
    );
  }

  async findActiveForTenantAndEventType(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookEndpoint[]> {
    const active = await this.endpointRepository.find({
      where: { tenantId, status: WebhookEndpointStatus.ACTIVE },
    });
    return active.filter((endpoint) => endpoint.eventTypes.includes(eventType));
  }

  async findByIdOrFail(id: string): Promise<WebhookEndpoint> {
    const endpoint = await this.endpointRepository.findOneBy({ id });
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }
    return endpoint;
  }
}
