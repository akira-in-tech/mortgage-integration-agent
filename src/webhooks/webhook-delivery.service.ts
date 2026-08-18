import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';
import { runInTenantContext } from '../database/tenant-context';

@Injectable()
export class WebhookDeliveryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Section 20 M5: cross-tenant fails closed at both the service layer
   * (the `tenantId` filter below) and, now, the database layer — this
   * table carries a real PostgreSQL RLS policy (`WebhookTenantIsolation`
   * migration) that `runInTenantContext` sets the session context for. A
   * delivery owned by a different tenant returns the identical 404 a
   * nonexistent id would, never a tenant-revealing 403.
   */
  async findByIdOrFail(tenantId: string, id: string): Promise<WebhookDelivery> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const delivery = await manager
        .getRepository(WebhookDelivery)
        .findOneBy({ id, tenantId });
      if (!delivery) {
        throw new NotFoundException(`Webhook delivery ${id} not found`);
      }
      return delivery;
    });
  }
}
