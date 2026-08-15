import { EntityManager } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { signOutboxPayload } from './outbox-signer';

export interface OutboxEventInput {
  tenantId: string;
  caseId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Writes a signed outbox row via the given `EntityManager` — callers must
 * pass the manager from an already-open transaction (e.g.
 * `dataSource.transaction(async (manager) => ...)`) alongside whatever
 * domain write the event describes, so both commit or roll back together
 * (Section 9.5: "COMMIT STATE AND OUTBOX EVENT"). Plain TypeORM, not a
 * NestJS provider, so it works both from src/workflows activities (outside
 * Nest's DI container by design — see case-conditions.activities.ts) and
 * from Nest-injected services such as CasesService.
 */
export async function writeOutboxEvent(
  manager: EntityManager,
  signingSecret: string,
  input: OutboxEventInput,
): Promise<void> {
  const repo = manager.getRepository(OutboxEvent);
  await repo.save(
    repo.create({
      tenantId: input.tenantId,
      caseId: input.caseId,
      eventType: input.eventType,
      payload: input.payload,
      signature: signOutboxPayload(input.payload, signingSecret),
    }),
  );
}
