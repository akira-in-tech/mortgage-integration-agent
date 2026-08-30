import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { LegalHold } from './database/entities/legal-hold.entity';
import { AuditEvent } from './database/entities/audit-event.entity';
import { LegalHoldService } from './data-disposition/legal-hold.service';
import { AuditEventService } from './audit/audit-event.service';

/**
 * `npm run manage-legal-hold -- <tenantId> <caseId> place <ownerId> <reason>`
 * `npm run manage-legal-hold -- <tenantId> <legalHoldId> release <releasedBy>`
 * — Section 14.1's `legal_holds` (M5-025). No REST endpoint exists for
 * this (the same honest gap `create-api-client.ts`/
 * `set-tenant-agent-budget.ts`/`set-provider-status.ts` already have),
 * and Section 14.2's own "explicit, scoped, reviewable" language for a
 * legal hold squarely describes a human, out-of-band decision anyway.
 */
async function main(): Promise<void> {
  const [tenantId, idArg, action, ...rest] = process.argv.slice(2);

  if (!tenantId || !idArg || !action) {
    console.error(
      'Usage:\n' +
        '  npm run manage-legal-hold -- <tenantId> <caseId> place <ownerId> <reason>\n' +
        '  npm run manage-legal-hold -- <tenantId> <legalHoldId> release <releasedBy>',
    );
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
    entities: [LegalHold, AuditEvent],
  });
  await dataSource.initialize();

  try {
    const service = new LegalHoldService(
      dataSource,
      new AuditEventService(dataSource),
    );
    if (action === 'place') {
      const [ownerId, ...reasonParts] = rest;
      const reason = reasonParts.join(' ').trim();
      if (!ownerId || !reason) {
        console.error(
          'Usage: npm run manage-legal-hold -- <tenantId> <caseId> place <ownerId> <reason>',
        );
        process.exit(1);
      }
      const hold = await service.place(tenantId, idArg, reason, ownerId);
      console.log(
        `Placed legal hold ${hold.id} on case ${idArg} (tenantId=${tenantId}, owner=${ownerId})`,
      );
    } else if (action === 'release') {
      const [releasedBy] = rest;
      if (!releasedBy) {
        console.error(
          'Usage: npm run manage-legal-hold -- <tenantId> <legalHoldId> release <releasedBy>',
        );
        process.exit(1);
      }
      const hold = await service.release(tenantId, idArg, releasedBy);
      console.log(
        `Released legal hold ${hold.id} (case ${hold.caseId}, tenantId=${tenantId}, releasedBy=${releasedBy})`,
      );
    } else {
      console.error('action must be "place" or "release"');
      process.exit(1);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('manage-legal-hold failed:', error.message ?? error);
  process.exit(1);
});
