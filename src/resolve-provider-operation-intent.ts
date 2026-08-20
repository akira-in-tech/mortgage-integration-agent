import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { ProviderOperationIntent } from './database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentStatus } from './database/enums/provider-platform.enum';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';

const VALID_OUTCOMES = [
  ProviderOperationIntentStatus.SUCCEEDED,
  ProviderOperationIntentStatus.FAILED_FINAL,
  ProviderOperationIntentStatus.CANCELLED,
];

/**
 * `npm run resolve-provider-operation-intent -- <tenantId> <intentId> <SUCCEEDED|FAILED_FINAL|CANCELLED> <resolvedBy> <resolutionNote>`
 * — Section 11.5's manual reconciliation path (M5-027): the real, human,
 * out-of-band resolution `ProviderReconciliationService` hands an
 * `OUTCOME_UNKNOWN`/`RECONCILING` intent off to. No automatic resolution
 * exists in this codebase (no adapter implements `poll()`, and no
 * receipt is ever persisted for one to poll against even if it did — see
 * that service's own comment) — an operator checking the real provider's
 * own records (e.g. a dashboard) and recording what actually happened is
 * the only real resolution path there is. No REST endpoint exists for
 * this either, the same honest gap this codebase's other administrative
 * scripts already have.
 */
async function main(): Promise<void> {
  const [tenantId, intentId, outcomeArg, resolvedBy, ...noteParts] =
    process.argv.slice(2);
  const resolutionNote = noteParts.join(' ').trim();

  if (!tenantId || !intentId || !outcomeArg || !resolvedBy || !resolutionNote) {
    console.error(
      'Usage: npm run resolve-provider-operation-intent -- <tenantId> <intentId> <SUCCEEDED|FAILED_FINAL|CANCELLED> <resolvedBy> <resolutionNote>',
    );
    process.exit(1);
  }
  if (!VALID_OUTCOMES.includes(outcomeArg as ProviderOperationIntentStatus)) {
    console.error(`outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [ProviderOperationIntent],
  });
  await dataSource.initialize();

  try {
    const service = new ProviderOperationIntentService(dataSource);
    await service.resolveManually(
      tenantId,
      intentId,
      outcomeArg as
        | ProviderOperationIntentStatus.SUCCEEDED
        | ProviderOperationIntentStatus.FAILED_FINAL
        | ProviderOperationIntentStatus.CANCELLED,
      resolvedBy,
      resolutionNote,
    );
    console.log(
      `Resolved intent ${intentId}: state=${outcomeArg} resolvedBy=${resolvedBy}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(
    'resolve-provider-operation-intent failed:',
    error.message ?? error,
  );
  process.exit(1);
});
