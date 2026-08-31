import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookEndpointStatus } from '../database/enums/webhook.enum';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { runInTenantContext } from '../database/tenant-context';
import {
  assertPublicWebhookTarget,
  isSandboxEnvironment,
  WebhookTargetBlockedError,
} from './webhook-url-guard';
import { NodeEnvironment } from '../config/env.validation';

@Injectable()
export class WebhookEndpointService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    // SSRF guard (Section 16.4): rejects a target that's a literal or
    // resolves to a private/reserved address before it's ever persisted.
    // `allowLoopbackForSandbox` only ever relaxes in development/test
    // (webhook-url-guard.ts's own `isSandboxEnvironment` is the single
    // source of truth for that) — the developer-sandbox webhook
    // inspector (M5-013) is the one real reason a loopback target is
    // ever legitimate.
    await this.assertSafeTarget(dto.targetUrl);

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

  /** Returns only the caller's tenant-owned endpoints; the signing secret stays server-side. */
  async list(tenantId: string): Promise<WebhookEndpoint[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(WebhookEndpoint).find({
        where: { tenantId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
  }

  /**
   * Edits affect only future fan-out. Existing durable deliveries retain the
   * endpoint and secret they were created with, so their signed history stays
   * attributable and replay-safe.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    if (dto.targetUrl !== undefined) await this.assertSafeTarget(dto.targetUrl);

    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(WebhookEndpoint);
      const endpoint = await repo.findOneBy({ id, tenantId });
      if (!endpoint) {
        throw new NotFoundException(`Webhook endpoint ${id} not found`);
      }
      if (dto.targetUrl !== undefined) endpoint.targetUrl = dto.targetUrl;
      if (dto.eventTypes !== undefined) endpoint.eventTypes = dto.eventTypes;
      return repo.save(endpoint);
    });
  }

  /**
   * DELETE is a revocation, not a physical cascade. Keeping the endpoint row
   * preserves the delivery/audit history required to explain past signed
   * messages; DISABLED endpoints receive no future fan-out.
   */
  async disable(tenantId: string, id: string): Promise<WebhookEndpoint> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(WebhookEndpoint);
      const endpoint = await repo.findOneBy({ id, tenantId });
      if (!endpoint) {
        throw new NotFoundException(`Webhook endpoint ${id} not found`);
      }
      endpoint.status = WebhookEndpointStatus.DISABLED;
      return repo.save(endpoint);
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

  private async assertSafeTarget(targetUrl: string): Promise<void> {
    const nodeEnv = this.configService.get<NodeEnvironment>('NODE_ENV');
    try {
      await assertPublicWebhookTarget(targetUrl, {
        allowLoopbackForSandbox: isSandboxEnvironment(
          nodeEnv ?? NodeEnvironment.Development,
        ),
      });
    } catch (error) {
      if (error instanceof WebhookTargetBlockedError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
