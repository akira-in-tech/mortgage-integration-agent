import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { CommunicationTemplate } from './database/entities/communication-template.entity';
import { CommunicationTemplateStatus } from './database/enums/communication.enum';

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * `npm run seed-communication-template -- <tenantId> <templateKey> <version> <channel> <locale> <recipientRelationship> <approvedBy> <bodyTemplate>`
 * — Section 6.4's "version-pinned tenant-approved template," the one
 * thing a `ROUTINE` communication may ever be built from
 * (`classifyCommunication`, communication-classifier.ts). No REST
 * endpoint exists for this (the same honest gap `create-api-client.ts`/
 * `set-tenant-agent-budget.ts`/`set-provider-status.ts` already have —
 * a platform-operational action this codebase's two-role tenant RBAC
 * has no admin tier for, and Section 6.4's own approval requirement for
 * *this specific class of content* is squarely a human, out-of-band
 * decision anyway).
 *
 * Creates the template already `APPROVED` — this script *is* the
 * approval act, matching the same single-step trust this codebase's
 * other administrative scripts already carry. `allowedVariables` is
 * derived from `bodyTemplate`'s own `{{variableName}}` placeholders,
 * not a separately supplied list — the two could otherwise drift, and
 * `renderTemplate`'s only source of truth for what a placeholder means
 * is the template body itself.
 *
 * `(tenantId, templateKey, version)` is a real unique constraint
 * (`UQ_communication_templates_tenant_key_version`) — a template is
 * immutable once it exists (`CommunicationTemplate`'s own class
 * comment: "a content change is a new version, never an in-place
 * edit"), so re-running this with the same three values fails loudly
 * rather than silently overwriting approved content a case may already
 * be relying on.
 */
async function main(): Promise<void> {
  const [
    tenantId,
    templateKey,
    version,
    channel,
    locale,
    recipientRelationship,
    approvedBy,
    bodyTemplate,
  ] = process.argv.slice(2);

  if (
    !tenantId ||
    !templateKey ||
    !version ||
    !channel ||
    !locale ||
    !recipientRelationship ||
    !approvedBy ||
    !bodyTemplate
  ) {
    console.error(
      'Usage: npm run seed-communication-template -- <tenantId> <templateKey> <version> <channel> <locale> <recipientRelationship> <approvedBy> <bodyTemplate>',
    );
    console.error(
      'bodyTemplate uses {{variableName}} placeholders — allowedVariables is derived from them automatically.',
    );
    process.exit(1);
  }

  const allowedVariables = [
    ...new Set(
      Array.from(bodyTemplate.matchAll(PLACEHOLDER_PATTERN), (m) => m[1]),
    ),
  ];

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [CommunicationTemplate],
  });
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(CommunicationTemplate);
    const existing = await repo.findOneBy({ tenantId, templateKey, version });
    if (existing) {
      console.error(
        `A template already exists at tenantId=${tenantId} templateKey=${templateKey} version=${version} — templates are immutable once created; use a new version instead of re-running this.`,
      );
      process.exit(1);
    }

    const template = await repo.save(
      repo.create({
        tenantId,
        templateKey,
        version,
        channel,
        locale,
        recipientRelationship,
        bodyTemplate,
        allowedVariables,
        attachmentsAllowed: false,
        status: CommunicationTemplateStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      }),
    );
    console.log(
      `Created and approved template ${template.id} (tenantId=${tenantId}, templateKey=${templateKey}@${version}, allowedVariables=[${allowedVariables.join(', ')}])`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('seed-communication-template failed:', error);
  process.exit(1);
});
