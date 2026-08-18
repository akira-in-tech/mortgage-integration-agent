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

  async findByIdOrFail(id: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepository.findOneBy({ id });
    if (!delivery) {
      throw new NotFoundException(`Webhook delivery ${id} not found`);
    }
    return delivery;
  }
}
