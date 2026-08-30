import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { ProviderPromotionManifest } from './database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from './database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from './database/entities/provider-approval-record.entity';
import { ProviderActivation } from './database/entities/provider-activation.entity';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
} from './database/enums/provider-promotion.enum';
import { ProviderPromotionService } from './provider-platform/provider-promotion.service';
import { ProviderCapability, ProviderMode } from './provider-platform/types';
import { AuditEvent } from './database/entities/audit-event.entity';
import { AuditEventService } from './audit/audit-event.service';

const VALID_MODES: ProviderMode[] = [
  'SIMULATOR',
  'AUTHORIZED_SANDBOX',
  'PRODUCTION_BYOC',
];

const USAGE = `Usage:
  npm run manage-provider-promotion -- propose <providerId> <capability> <mode> <adapterVersion> <proposedBy> <endpointAllowlistCsv> <dataClassificationsCsv> [validUntilISO]
  npm run manage-provider-promotion -- certify <manifestId> <environment> <certifiedBy> <PASSED|FAILED|REVOKED> <evidenceRef> [expiresAtISO]
  npm run manage-provider-promotion -- approve <manifestId> <approvalRole> <approvedBy> <APPROVED|REJECTED|REVOKED> [expiresAtISO]
  npm run manage-provider-promotion -- activate <manifestId> <environment> <activatedBy> <expectedCurrentManifestVersion|none>
  npm run manage-provider-promotion -- deactivate <providerId> <capability> <mode> <actorId>
  npm run manage-provider-promotion -- status <providerId> <capability> <mode>`;

function requireCapability(arg: string): ProviderCapability {
  if (!Object.values(ProviderCapability).includes(arg as ProviderCapability)) {
    console.error(
      `Invalid capability "${arg}" — must be one of: ${Object.values(ProviderCapability).join(', ')}`,
    );
    process.exit(1);
  }
  return arg as ProviderCapability;
}

function requireMode(arg: string): ProviderMode {
  if (!VALID_MODES.includes(arg as ProviderMode)) {
    console.error(
      `Invalid mode "${arg}" — must be one of: ${VALID_MODES.join(', ')}`,
    );
    process.exit(1);
  }
  return arg as ProviderMode;
}

function parseOptionalDate(arg: string | undefined): Date | undefined {
  if (!arg) return undefined;
  const parsed = new Date(arg);
  if (Number.isNaN(parsed.getTime())) {
    console.error(`Invalid date "${arg}" — expected an ISO 8601 timestamp`);
    process.exit(1);
  }
  return parsed;
}

/**
 * Section 11.4's governed promotion chain (M4-007): propose -> certify ->
 * approve -> activate. No REST endpoint exists for this (the same honest
 * gap `set-provider-status.ts`/`manage-legal-hold.ts` already have — this
 * codebase's two-role tenant RBAC has no admin tier), and every one of
 * these is a human, out-of-band governance decision anyway (Section
 * 16.1's "independent approval" language).
 *
 * Every state-changing action below writes a real `audit_events` row
 * (M7-028) — `ProviderPromotionService` records it directly, so this
 * script gets the same provenance the console's REST path does.
 */
async function main(): Promise<void> {
  const [action, ...rest] = process.argv.slice(2);
  if (!action) {
    console.error(USAGE);
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
      ProviderPromotionManifest,
      ProviderCertificationRecord,
      ProviderApprovalRecord,
      ProviderActivation,
      AuditEvent,
    ],
  });
  await dataSource.initialize();

  try {
    const service = new ProviderPromotionService(
      dataSource.getRepository(ProviderPromotionManifest),
      dataSource.getRepository(ProviderCertificationRecord),
      dataSource.getRepository(ProviderApprovalRecord),
      dataSource.getRepository(ProviderActivation),
      new AuditEventService(dataSource),
    );

    if (action === 'propose') {
      const [
        providerId,
        capabilityArg,
        modeArg,
        adapterVersion,
        proposedBy,
        endpointAllowlistCsv,
        dataClassificationsCsv,
        validUntilArg,
      ] = rest;
      if (
        !providerId ||
        !capabilityArg ||
        !modeArg ||
        !adapterVersion ||
        !proposedBy ||
        !endpointAllowlistCsv ||
        !dataClassificationsCsv
      ) {
        console.error(USAGE);
        process.exit(1);
      }
      const manifest = await service.propose({
        providerId,
        capability: requireCapability(capabilityArg),
        mode: requireMode(modeArg),
        adapterVersion,
        endpointAllowlist: endpointAllowlistCsv.split(',').map((s) => s.trim()),
        dataClassifications: dataClassificationsCsv
          .split(',')
          .map((s) => s.trim()),
        proposedBy,
        validUntil: parseOptionalDate(validUntilArg) ?? null,
      });
      console.log(
        `Proposed manifest ${manifest.id} (${providerId}/${manifest.capability}/${manifest.mode} v${manifest.version}, contentHash=${manifest.contentHash})`,
      );
    } else if (action === 'certify') {
      const [
        manifestId,
        environment,
        certifiedBy,
        decisionArg,
        evidenceRef,
        expiresAtArg,
      ] = rest;
      if (
        !manifestId ||
        !environment ||
        !certifiedBy ||
        !decisionArg ||
        !evidenceRef
      ) {
        console.error(USAGE);
        process.exit(1);
      }
      if (
        !Object.values(ProviderCertificationDecision).includes(
          decisionArg as ProviderCertificationDecision,
        )
      ) {
        console.error(
          `Invalid decision "${decisionArg}" — must be one of: ${Object.values(ProviderCertificationDecision).join(', ')}`,
        );
        process.exit(1);
      }
      const record = await service.certify(
        manifestId,
        environment,
        certifiedBy,
        decisionArg as ProviderCertificationDecision,
        evidenceRef,
        parseOptionalDate(expiresAtArg) ?? null,
      );
      console.log(
        `Certification ${record.id} for manifest ${manifestId} (environment=${environment}): ${record.decision}`,
      );
    } else if (action === 'approve') {
      const [manifestId, approvalRole, approvedBy, decisionArg, expiresAtArg] =
        rest;
      if (!manifestId || !approvalRole || !approvedBy || !decisionArg) {
        console.error(USAGE);
        process.exit(1);
      }
      if (
        !Object.values(ProviderApprovalDecision).includes(
          decisionArg as ProviderApprovalDecision,
        )
      ) {
        console.error(
          `Invalid decision "${decisionArg}" — must be one of: ${Object.values(ProviderApprovalDecision).join(', ')}`,
        );
        process.exit(1);
      }
      const record = await service.approve(
        manifestId,
        approvalRole,
        approvedBy,
        decisionArg as ProviderApprovalDecision,
        parseOptionalDate(expiresAtArg) ?? null,
      );
      console.log(
        `Approval ${record.id} for manifest ${manifestId} (role=${approvalRole}): ${record.decision}`,
      );
    } else if (action === 'activate') {
      const [manifestId, environment, activatedBy, expectedVersionArg] = rest;
      if (
        !manifestId ||
        !environment ||
        !activatedBy ||
        expectedVersionArg === undefined
      ) {
        console.error(USAGE);
        process.exit(1);
      }
      const expectedVersion =
        expectedVersionArg === 'none' ? null : Number(expectedVersionArg);
      if (expectedVersion !== null && Number.isNaN(expectedVersion)) {
        console.error(
          'expectedCurrentManifestVersion must be an integer or "none"',
        );
        process.exit(1);
      }
      const activation = await service.activate(
        manifestId,
        environment,
        activatedBy,
        expectedVersion,
      );
      console.log(
        `Activated ${activation.providerId}/${activation.capability}/${activation.mode} -> manifest ${activation.manifestId} v${activation.manifestVersion}`,
      );
    } else if (action === 'deactivate') {
      const [providerId, capabilityArg, modeArg, actorId] = rest;
      if (!providerId || !capabilityArg || !modeArg || !actorId) {
        console.error(USAGE);
        process.exit(1);
      }
      await service.deactivate(
        providerId,
        requireCapability(capabilityArg),
        requireMode(modeArg),
        actorId,
      );
      console.log(`Deactivated ${providerId}/${capabilityArg}/${modeArg}`);
    } else if (action === 'status') {
      const [providerId, capabilityArg, modeArg] = rest;
      if (!providerId || !capabilityArg || !modeArg) {
        console.error(USAGE);
        process.exit(1);
      }
      const activated = await service.isActivated(
        providerId,
        requireCapability(capabilityArg),
        requireMode(modeArg),
      );
      console.log(
        `${providerId}/${capabilityArg}/${modeArg} is ${activated ? 'ACTIVE' : 'NOT ACTIVATED'}`,
      );
    } else {
      console.error(USAGE);
      process.exit(1);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('manage-provider-promotion failed:', error.message ?? error);
  process.exit(1);
});
