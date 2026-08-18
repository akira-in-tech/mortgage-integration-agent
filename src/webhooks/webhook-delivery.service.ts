import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';

@Injectable()
export class WebhookDeliveryService {
  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  /**
   * Section 20 M5: cross-tenant fails closed the same way
   * `CasesService.getCase()` does — a delivery owned by a different
   * tenant returns the identical 404 a nonexistent id would, never a
   * tenant-revealing 403.
   */
  async findByIdOrFail(tenantId: string, id: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepository.findOneBy({
      id,
      tenantId,
    });
    if (!delivery) {
      throw new NotFoundException(`Webhook delivery ${id} not found`);
    }
    return delivery;
  }
}
