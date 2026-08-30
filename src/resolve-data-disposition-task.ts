import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { DataDispositionTask } from './database/entities/data-disposition-task.entity';
import { LegalHold } from './database/entities/legal-hold.entity';
import { EvidenceFact } from './database/entities/evidence-fact.entity';
import { LoanCase } from './database/entities/loan-case.entity';
import { Tenant } from './database/entities/tenant.entity';
import { Jurisdiction } from './database/entities/jurisdiction.entity';
import { AuditEvent } from './database/entities/audit-event.entity';
import { DataDispositionService } from './data-disposition/data-disposition.service';
import { LegalHoldService } from './data-disposition/legal-hold.service';
import { AuditEventService } from './audit/audit-event.service';

/**
 * `npm run resolve-data-disposition-task -- <tenantId> <taskId> <DELETE|ANONYMIZE|RETAIN> <actorId>`
 * — Section 14.2's "deletion verification" (M5-025): the first real
 * thing that ever acts on a `data_disposition_tasks` row opened by
 * `ConsentService.revoke()`. No REST endpoint exists for this (the same
 * honest gap this codebase's other administrative scripts already
 * have) — deciding to actually delete or anonymize collected evidence
 * is squarely a human, out-of-band decision, not something this
 * codebase's own automation should ever do unattended.
 *
 * A resolution run through this script now writes the same
 * `audit_events` row a REST-driven resolution does (M7-028) —
 * `DataDispositionService.resolve()` records it directly, so this script
 * gets it for free rather than needing its own separate write.
 */
async function main(): Promise<void> {
  const [tenantId, taskId, actionArg, actorId] = process.argv.slice(2);

  if (!tenantId || !taskId || !actionArg || !actorId) {
    console.error(
      'Usage: npm run resolve-data-disposition-task -- <tenantId> <taskId> <DELETE|ANONYMIZE|RETAIN> <actorId>',
    );
    process.exit(1);
  }
  if (!['DELETE', 'ANONYMIZE', 'RETAIN'].includes(actionArg)) {
    console.error('action must be one of: DELETE, ANONYMIZE, RETAIN');
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
    entities: [
      DataDispositionTask,
      LegalHold,
      EvidenceFact,
      LoanCase,
      Tenant,
      Jurisdiction,
      AuditEvent,
    ],
  });
  await dataSource.initialize();

  try {
    const auditEventService = new AuditEventService(dataSource);
    const service = new DataDispositionService(
      dataSource,
      new LegalHoldService(dataSource, auditEventService),
      auditEventService,
    );
    const task = await service.resolve(
      tenantId,
      taskId,
      actionArg as 'DELETE' | 'ANONYMIZE' | 'RETAIN',
      actorId,
    );
    console.log(
      `Resolved data disposition task ${task.id}: status=${task.status} outcome=${task.resolutionOutcome} (${task.affectedEvidenceFactIds.length} evidence record(s) affected)`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(
    'resolve-data-disposition-task failed:',
    error.message ?? error,
  );
  process.exit(1);
});
