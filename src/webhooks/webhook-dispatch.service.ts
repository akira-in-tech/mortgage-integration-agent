import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull, LessThanOrEqual } from 'typeorm';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import {
  WebhookDelivery,
  WebhookDeliveryAttempt,
} from '../database/entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../database/enums/webhook.enum';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { signWebhookDelivery } from './webhook-signer';
import {
  assertPublicWebhookTarget,
  isSandboxEnvironment,
} from './webhook-url-guard';
import { NodeEnvironment } from '../config/env.validation';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';
import { operationalTelemetry } from '../observability/operational-telemetry';

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
 *
 * `webhook_endpoints`/`webhook_deliveries` (M5-002) and `outbox_events`
 * (M5-004) all carry a real RLS policy. Every query against them here
 * uses `runInTenantContext` with a tenantId this method already knows
 * (the outbox event's own, or the delivery's own) — `runWithRlsBypass`
 * (an explicit, audited cross-tenant opt-out) is used exactly twice, for
 * the two queries that are genuinely cross-tenant by design: scanning
 * for *any* tenant's unpublished events, and *any* tenant's due
 * deliveries.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly endpointService: WebhookEndpointService,
    private readonly configService: ConfigService,
  ) {}

  async dispatchPendingEvents(
    options: DispatchPendingEventsOptions = {},
  ): Promise<DispatchPendingEventsResult> {
    return operationalTelemetry.observeWebhookBatch(() =>
      this.dispatchPendingEventsInternal(options),
    );
  }

  private async dispatchPendingEventsInternal(
    options: DispatchPendingEventsOptions,
  ): Promise<DispatchPendingEventsResult> {
    const now = options.now ?? new Date();

    // Genuinely cross-tenant by design, same reasoning as the due-
    // deliveries scan below — every tenant's unpublished events, not one.
    const events = await runWithRlsBypass(this.dataSource, (manager) =>
      manager.getRepository(OutboxEvent).find({
        where: { publishedAt: IsNull() },
        order: { createdAt: 'ASC' },
        take: EVENT_BATCH_SIZE,
      }),
    );

    for (const event of events) {
      const endpoints =
        await this.endpointService.findActiveForTenantAndEventType(
          event.tenantId,
          event.eventType,
        );
      // This event's own tenant is already known — scope the delivery
      // rows to it directly rather than reaching for the bypass helper.
      await runInTenantContext(
        this.dataSource,
        event.tenantId,
        async (manager) => {
          const deliveryRepo = manager.getRepository(WebhookDelivery);
          for (const endpoint of endpoints) {
            const existing = await deliveryRepo.findOneBy({
              outboxEventId: event.id,
              webhookEndpointId: endpoint.id,
            });
            if (!existing) {
              await deliveryRepo.save(
                deliveryRepo.create({
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
        },
      );
      // "Published" means handed off to the webhook subsystem (delivery
      // rows created for every currently-subscribed endpoint) — the same
      // meaning the transactional-outbox pattern always gives this field,
      // not "successfully delivered to every subscriber." outbox_events
      // carries a real RLS policy (M5-004) — this event's own tenant is
      // already known, so this uses runInTenantContext rather than bypass.
      await runInTenantContext(this.dataSource, event.tenantId, (manager) =>
        manager
          .getRepository(OutboxEvent)
          .update({ id: event.id }, { publishedAt: now }),
      );
    }

    // Genuinely cross-tenant by design — the one place this file needs
    // the explicit bypass rather than a known tenantId.
    const due = await runWithRlsBypass(this.dataSource, (manager) =>
      manager.getRepository(WebhookDelivery).find({
        where: [
          { status: WebhookDeliveryStatus.PENDING, nextAttemptAt: IsNull() },
          {
            status: WebhookDeliveryStatus.PENDING,
            nextAttemptAt: LessThanOrEqual(now),
          },
        ],
        take: DELIVERY_BATCH_SIZE,
      }),
    );

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
      delivery.tenantId,
      delivery.webhookEndpointId,
    );
    const rateReservation = await this.endpointService.reserveOutboundAttempt(
      delivery.tenantId,
      endpoint.id,
      now,
    );
    if (!rateReservation.reserved) {
      // Deferral preserves the durable delivery and avoids hot-looping until
      // the receiver's next permitted UTC-minute window.
      await runInTenantContext(this.dataSource, delivery.tenantId, (manager) =>
        manager
          .getRepository(WebhookDelivery)
          .update(
            { id: delivery.id, status: WebhookDeliveryStatus.PENDING },
            { nextAttemptAt: rateReservation.nextWindowAt },
          ),
      );
      return;
    }
    const event = await runInTenantContext(
      this.dataSource,
      delivery.tenantId,
      (manager) =>
        manager
          .getRepository(OutboxEvent)
          .findOneByOrFail({ id: delivery.outboxEventId }),
    );

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

    // Deliberately no open transaction/connection held across this call —
    // a slow or hanging receiver must not tie up a pooled DB connection
    // for up to DELIVERY_TIMEOUT_MS.
    let httpStatusCode: number | null = null;
    let outcome: 'SUCCEEDED' | 'FAILED';
    let errorMessage: string | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      // Re-checked here, not just once at registration (webhook-url-guard.ts's
      // own comment on why): DNS answers can legitimately change between
      // registration and a retried delivery firing hours or days later.
      const nodeEnv = this.configService.get<NodeEnvironment>('NODE_ENV');
      await assertPublicWebhookTarget(endpoint.targetUrl, {
        allowLoopbackForSandbox: isSandboxEnvironment(
          nodeEnv ?? NodeEnvironment.Development,
        ),
      });
      const response = await fetch(endpoint.targetUrl, {
        method: 'POST',
        // Webhook destinations are stable integration contracts, not browser
        // navigation. Refusing redirects prevents a public URL from pivoting
        // this signed request to an unchecked private address and prevents
        // credentials intended for one receiver from crossing origins.
        redirect: 'error',
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

    await runInTenantContext(this.dataSource, delivery.tenantId, (manager) =>
      manager
        .getRepository(WebhookDelivery)
        .update({ id: delivery.id }, { attempts, status, nextAttemptAt }),
    );
    operationalTelemetry.recordWebhookDelivery(
      outcome,
      status === WebhookDeliveryStatus.FAILED_FINAL,
    );
  }
}
