import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookEndpointStatus } from '../database/enums/webhook.enum';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { runInTenantContext } from '../database/tenant-context';
import {
  assertPublicWebhookTarget,
  WebhookTargetBlockedError,
} from './webhook-url-guard';

@Injectable()
export class WebhookEndpointService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    tenantId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    // SSRF guard (Section 16.4): rejects a target that's a literal or
    // resolves to a private/reserved address before it's ever persisted.
    try {
      await assertPublicWebhookTarget(dto.targetUrl);
    } catch (error) {
      if (error instanceof WebhookTargetBlockedError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    return runInTenantContext(this.dataSource, tenantId, (manager) => {
      const repo = manager.getRepository(WebhookEndpoint);
      return repo.save(
        repo.create({
          tenantId,
          targetUrl: dto.targetUrl,
          eventTypes: dto.eventTypes,
          secret: randomBytes(32).toString('hex'),
          status: WebhookEndpointStatus.ACTIVE,
        }),
      );
    });
  }

  async findActiveForTenantAndEventType(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookEndpoint[]> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const active = await manager.getRepository(WebhookEndpoint).find({
        where: { tenantId, status: WebhookEndpointStatus.ACTIVE },
      });
      return active.filter((endpoint) =>
        endpoint.eventTypes.includes(eventType),
      );
    });
  }

  async findByIdOrFail(tenantId: string, id: string): Promise<WebhookEndpoint> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const endpoint = await manager
        .getRepository(WebhookEndpoint)
        .findOneBy({ id, tenantId });
      if (!endpoint) {
        throw new NotFoundException(`Webhook endpoint ${id} not found`);
      }
      return endpoint;
    });
  }
}
