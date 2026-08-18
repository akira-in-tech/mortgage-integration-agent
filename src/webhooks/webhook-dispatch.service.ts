import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import {
  WebhookDelivery,
  WebhookDeliveryAttempt,
} from '../database/entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../database/enums/webhook.enum';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { signWebhookDelivery } from './webhook-signer';

/** Bounds how much work one `dispatchPendingEvents()` call does — a real production safety property (Worker service, Section 12.1's "webhook delivery"), not an arbitrary test convenience. */
const EVENT_BATCH_SIZE = 50;
const DELIVERY_BATCH_SIZE = 50;
/** After this many failed attempts, a delivery reaches `FAILED_FINAL` rather than retrying forever. */
const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT_MS = 10_000;

function backoffMs(attemptNumber: number): number {
  return Math.min(1000 * 2 ** attemptNumber, 60_000);
}

export interface DispatchPendingEventsOptions {
  /** Injectable clock, same pattern as `webhook-signer.ts`'s `verifyWebhookSignature` — lets tests simulate a retry becoming due without a real wall-clock wait, without making production backoff intervals artificially short. */
  now?: Date;
}

export interface DispatchPendingEventsResult {
  eventsProcessed: number;
  attemptsMade: number;
}

/**
 * Section 12.1's Worker service scope: "webhook delivery." Reads
 * `outbox_events` where `publishedAt IS NULL` (M2's transactional outbox,
 * which never had a dispatcher until now), fans each one out to a
 * `WebhookDelivery` row per active, subscribed `WebhookEndpoint`, then
 * attempts every delivery that's due — a fresh one, or one whose
 * exponential backoff window has elapsed. `worker.ts` calls
 * `dispatchPendingEvents()` on an interval (not a Temporal
 * workflow/activity — this dispatcher doesn't need Temporal's durable-
 * execution guarantees, since a `WebhookDelivery` row already *is* the
 * durable record of what's been attempted and what's still due; a crash
 * between attempts loses nothing, the next poll just picks it back up).
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    private readonly endpointService: WebhookEndpointService,
  ) {}

  async dispatchPendingEvents(
    options: DispatchPendingEventsOptions = {},
  ): Promise<DispatchPendingEventsResult> {
    const now = options.now ?? new Date();

    const events = await this.outboxRepository.find({
      where: { publishedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: EVENT_BATCH_SIZE,
    });

    for (const event of events) {
      const endpoints =
        await this.endpointService.findActiveForTenantAndEventType(
          event.tenantId,
          event.eventType,
        );
      for (const endpoint of endpoints) {
        const existing = await this.deliveryRepository.findOneBy({
          outboxEventId: event.id,
          webhookEndpointId: endpoint.id,
        });
        if (!existing) {
          await this.deliveryRepository.save(
            this.deliveryRepository.create({
              tenantId: event.tenantId,
              webhookEndpointId: endpoint.id,
              outboxEventId: event.id,
              eventType: event.eventType,
              status: WebhookDeliveryStatus.PENDING,
              attempts: [],
              nextAttemptAt: null,
            }),
          );
        }
      }
      // "Published" means handed off to the webhook subsystem (delivery
      // rows created for every currently-subscribed endpoint) — the same
      // meaning the transactional-outbox pattern always gives this field,
      // not "successfully delivered to every subscriber."
      await this.outboxRepository.update(
        { id: event.id },
        { publishedAt: now },
      );
    }

    const due = await this.deliveryRepository.find({
      where: [
        { status: WebhookDeliveryStatus.PENDING, nextAttemptAt: IsNull() },
        {
          status: WebhookDeliveryStatus.PENDING,
          nextAttemptAt: LessThanOrEqual(now),
        },
      ],
      take: DELIVERY_BATCH_SIZE,
    });

    for (const delivery of due) {
      await this.attemptDelivery(delivery, now);
    }

    return { eventsProcessed: events.length, attemptsMade: due.length };
  }

  private async attemptDelivery(
    delivery: WebhookDelivery,
    now: Date,
  ): Promise<void> {
    const endpoint = await this.endpointService.findByIdOrFail(
      delivery.webhookEndpointId,
    );
    const event = await this.outboxRepository.findOneByOrFail({
      id: delivery.outboxEventId,
    });

    const attemptNumber = delivery.attempts.length + 1;
    const timestampIso = now.toISOString();
    const rawBody = JSON.stringify({
      id: delivery.id,
      type: delivery.eventType,
      timestamp: timestampIso,
      data: event.payload,
    });
    const signature = signWebhookDelivery(
      delivery.id,
      timestampIso,
      rawBody,
      endpoint.secret,
    );

    let httpStatusCode: number | null = null;
    let outcome: 'SUCCEEDED' | 'FAILED';
    let errorMessage: string | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint.targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-id': delivery.id,
          'x-webhook-timestamp': timestampIso,
          'x-webhook-signature': signature,
        },
        body: rawBody,
        signal: controller.signal,
      });
      httpStatusCode = response.status;
      outcome = response.ok ? 'SUCCEEDED' : 'FAILED';
      if (!response.ok) {
        errorMessage = `receiver responded HTTP ${response.status}`;
      }
    } catch (error) {
      outcome = 'FAILED';
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }

    const attempt: WebhookDeliveryAttempt = {
      attemptNumber,
      attemptedAt: timestampIso,
      httpStatusCode,
      outcome,
      errorMessage,
    };
    const attempts = [...delivery.attempts, attempt];

    let status: WebhookDeliveryStatus;
    let nextAttemptAt: Date | null;
    if (outcome === 'SUCCEEDED') {
      status = WebhookDeliveryStatus.SUCCEEDED;
      nextAttemptAt = null;
    } else if (attemptNumber >= MAX_ATTEMPTS) {
      status = WebhookDeliveryStatus.FAILED_FINAL;
      nextAttemptAt = null;
      this.logger.warn(
        `Webhook delivery ${delivery.id} reached FAILED_FINAL after ${attemptNumber} attempts [endpoint=${endpoint.id}] [event=${event.eventType}]`,
      );
    } else {
      status = WebhookDeliveryStatus.PENDING;
      nextAttemptAt = new Date(now.getTime() + backoffMs(attemptNumber));
    }

    await this.deliveryRepository.update(
      { id: delivery.id },
      { attempts, status, nextAttemptAt },
    );
  }
}
