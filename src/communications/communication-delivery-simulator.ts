import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface SimulatedDelivery {
  deliveryReference: string;
}

/**
 * Mock delivery channel, same honest status as `PlaidService`/
 * `CreditService`/`DocumentService` (src/integrations/): no real email/SMS
 * provider integration exists yet (Section 11, M4 scope) — this simulates
 * what a real channel's API would hand back (an opaque confirmation id),
 * deterministically from the message id and content hash so the same
 * message always "delivers" to the same reference.
 */
@Injectable()
export class CommunicationDeliverySimulator {
  private readonly logger = new Logger(CommunicationDeliverySimulator.name);

  async send(
    communicationMessageId: string,
    renderedContentHash: string,
    channel: string,
  ): Promise<SimulatedDelivery> {
    this.logger.debug(
      `Simulating delivery [messageId=${communicationMessageId}] [channel=${channel}]`,
    );
    const deliveryReference = `sim-${createHash('sha256')
      .update(`${communicationMessageId}:${renderedContentHash}`)
      .digest('hex')
      .slice(0, 24)}`;
    this.logger.debug(
      `Simulated delivery complete [messageId=${communicationMessageId}] [deliveryReference=${deliveryReference}]`,
    );
    return { deliveryReference };
  }
}
