import { config as loadEnv } from 'dotenv';
loadEnv();

import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant } from './database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from './database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from './database/entities/provider-adapter-status.entity';
import { ProviderPromotionManifest } from './database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from './database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from './database/entities/provider-approval-record.entity';
import { ProviderActivation } from './database/entities/provider-activation.entity';
import { ConsentRecord } from './database/entities/consent-record.entity';
import { AuditEvent } from './database/entities/audit-event.entity';
import { AuditEventService } from './audit/audit-event.service';
import { ProviderRegistryService } from './provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from './provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';
import { ProviderKillSwitchService } from './provider-platform/provider-kill-switch.service';
import { ProviderPromotionService } from './provider-platform/provider-promotion.service';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
} from './database/enums/provider-promotion.enum';
import { ConsentService } from './consent/consent.service';
import { DataDispositionService } from './data-disposition/data-disposition.service';
import { LegalHoldService } from './data-disposition/legal-hold.service';
import {
  dispatchProviderRequest,
  ProviderNotActivatedError,
} from './provider-platform/dispatch-provider-request';
import {
  AnyProviderAdapter,
  ProviderCapability,
} from './provider-platform/types';

/**
 * `npm run kill-switch-drill` — Charter Section 29 item 6's last piece:
 * a real, repeatable exercise proving the promotion-chain kill switch
 * (`ProviderPromotionService.deactivate()`) actually blocks live
 * dispatch, not just that a database row's `state` column changes.
 * `dispatch-provider-request.spec.ts`'s own promotion-gate test now
 * covers this same round trip under Jest; this script runs the
 * identical real sequence standalone, against whatever real Postgres
 * DATABASE_URL points at, and prints real, timestamped evidence for
 * each step - the same "make it inspectable outside the test runner"
 * reasoning `evaluation-report.ts`/`create-platform-admin.ts` already
 * follow for their own one-off scripts.
 *
 * Uses a minimal synthetic drill adapter, not a real provider
 * integration - it proves the activation *gate* is enforced (whether
 * dispatchProviderRequest lets the call reach the adapter at all), not
 * that any specific real adapter's own submit() call succeeds. No real
 * provider credential is needed for that.
 */

const PROVIDER_ID = 'kill-switch-drill-provider';
const CAPABILITY = ProviderCapability.ASSET;
const MODE = 'AUTHORIZED_SANDBOX' as const;

const drillAdapter: AnyProviderAdapter = {
  providerId: PROVIDER_ID,
  capability: CAPABILITY,
  mode: MODE,
  operation: {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  },
  submit: async () => ({ status: 'COMPLETE', payload: { drill: true } }),
  normalize: (payload) => payload,
  healthCheck: async () => ({
    healthy: true,
    checkedAt: new Date().toISOString(),
  }),
};

function log(step: string, detail: string): void {
  console.log(`[${new Date().toISOString()}] ${step}: ${detail}`);
}

type DispatchResult =
  | { ok: true; finding: unknown }
  | { ok: false; isNotActivatedError: boolean; error: string };

// Distinguishes the specific rejection this drill is proving
// (ProviderNotActivatedError, the promotion-chain gate) from any other
// error - a drill that called "rejected" a passing result regardless of
// *why* it was rejected would be weaker evidence than what it claims.
async function attemptDispatch(
  deps: Parameters<typeof dispatchProviderRequest>[0],
  tenantId: string,
): Promise<DispatchResult> {
  try {
    const finding = await dispatchProviderRequest(deps, {
      tenantId,
      caseId: randomUUID(),
      borrowerSubjectId: 'kill-switch-drill-borrower',
      capability: CAPABILITY,
      mode: MODE,
      request: {},
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
    });
    return { ok: true, finding };
  } catch (error) {
    return {
      ok: false,
      isNotActivatedError: error instanceof ProviderNotActivatedError,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      ProviderAuthorizationGrant,
      ProviderOperationIntent,
      ProviderAdapterStatus,
      ProviderPromotionManifest,
      ProviderCertificationRecord,
      ProviderApprovalRecord,
      ProviderActivation,
      ConsentRecord,
      AuditEvent,
    ],
  });
  await dataSource.initialize();

  const registry = new ProviderRegistryService();
  registry.register(drillAdapter);
  const auditEventService = new AuditEventService(dataSource);
  const dataDispositionService = new DataDispositionService(
    dataSource,
    new LegalHoldService(dataSource, auditEventService),
    auditEventService,
  );
  const consentService = new ConsentService(dataSource, dataDispositionService);
  const authorizationService = new ProviderAuthorizationService(
    dataSource,
    consentService,
  );
  const intentService = new ProviderOperationIntentService(dataSource);
  const killSwitchService = new ProviderKillSwitchService(dataSource);
  const promotionService = new ProviderPromotionService(
    dataSource.getRepository(ProviderPromotionManifest),
    dataSource.getRepository(ProviderCertificationRecord),
    dataSource.getRepository(ProviderApprovalRecord),
    dataSource.getRepository(ProviderActivation),
    auditEventService,
  );
  const deps = {
    registry,
    authorizationService,
    intentService,
    killSwitchService,
    promotionService,
    consentService,
  };

  const tenantId = randomUUID();
  let passed = true;

  try {
    log(
      'STEP 1',
      `dispatching before any promotion exists (tenant ${tenantId})`,
    );
    const before = await attemptDispatch(deps, tenantId);
    if (before.ok) {
      passed = false;
      log(
        'STEP 1 FAILED',
        'dispatch succeeded with no activation at all - the default-deny gate did not hold',
      );
    } else if (!before.isNotActivatedError) {
      passed = false;
      log(
        'STEP 1 FAILED',
        `rejected, but not for the expected reason (ProviderNotActivatedError): ${before.error}`,
      );
    } else {
      log(
        'STEP 1 OK',
        `real dispatch rejected before promotion: ${before.error}`,
      );
    }

    log('STEP 2', 'proposing a real promotion manifest');
    const manifest = await promotionService.propose({
      providerId: PROVIDER_ID,
      capability: CAPABILITY,
      mode: MODE,
      adapterVersion: '1.0.0-drill',
      endpointAllowlist: ['https://example.invalid/kill-switch-drill'],
      dataClassifications: ['ASSET'],
      proposedBy: 'kill-switch-drill-operator',
    });
    log('STEP 2 OK', `manifest ${manifest.id} proposed`);

    log('STEP 3', 'certifying and approving the manifest');
    await promotionService.certify(
      manifest.id,
      'sandbox',
      'kill-switch-drill-operator',
      ProviderCertificationDecision.PASSED,
      'evidence://kill-switch-drill',
    );
    await promotionService.approve(
      manifest.id,
      'compliance',
      'kill-switch-drill-approver',
      ProviderApprovalDecision.APPROVED,
    );
    log('STEP 3 OK', 'certified and approved');

    log(
      'STEP 4',
      'activating the manifest (this is what real dispatch will now honor)',
    );
    const activation = await promotionService.activate(
      manifest.id,
      'sandbox',
      'kill-switch-drill-activator',
      null,
    );
    log('STEP 4 OK', `activation ${activation.id} state=${activation.state}`);

    log('STEP 5', 'dispatching a real request now that the tuple is active');
    const active = await attemptDispatch(deps, tenantId);
    if (!active.ok) {
      passed = false;
      log(
        'STEP 5 FAILED',
        `dispatch was rejected even though the tuple is active: ${active.error}`,
      );
    } else {
      log(
        'STEP 5 OK',
        `real dispatch succeeded: ${JSON.stringify(active.finding)}`,
      );
    }

    log('STEP 6', 'pulling the kill switch: deactivate()');
    const deactivated = await promotionService.deactivate(
      PROVIDER_ID,
      CAPABILITY,
      MODE,
      'kill-switch-drill-operator',
    );
    log('STEP 6 OK', `activation ${deactivated.id} state=${deactivated.state}`);

    log(
      'STEP 7',
      'dispatching again immediately after the kill switch - this must be rejected',
    );
    const after = await attemptDispatch(deps, tenantId);
    if (after.ok) {
      passed = false;
      log(
        'STEP 7 FAILED',
        'dispatch succeeded after deactivate() - the kill switch did not hold',
      );
    } else if (!after.isNotActivatedError) {
      passed = false;
      log(
        'STEP 7 FAILED',
        `rejected, but not for the expected reason (ProviderNotActivatedError): ${after.error}`,
      );
    } else {
      log(
        'STEP 7 OK',
        `real dispatch rejected immediately after the kill switch: ${after.error}`,
      );
    }
  } finally {
    // A drill leaves nothing behind - the same "clean up exactly what
    // this run created" discipline dispatch-provider-request.spec.ts's
    // own afterAll follows. One deliberate exception (M7-028): every
    // propose/certify/approve/activate/deactivate call above now writes
    // a real `audit_events` row, and that table's own append-only
    // trigger rejects DELETE unconditionally (see AuditEvents migration)
    // - so this drill's own audit trail under the
    // 'kill-switch-drill-*' actor ids is the one thing that genuinely
    // can't be cleaned up, by design, not an oversight here.
    await dataSource
      .getRepository(ProviderOperationIntent)
      .createQueryBuilder()
      .delete()
      .where('"tenantId" = :id', { id: tenantId })
      .execute();
    await dataSource
      .getRepository(ProviderAuthorizationGrant)
      .createQueryBuilder()
      .delete()
      .where('"tenantId" = :id', { id: tenantId })
      .execute();
    await dataSource
      .getRepository(ProviderActivation)
      .delete({ providerId: PROVIDER_ID });
    const manifests = await dataSource
      .getRepository(ProviderPromotionManifest)
      .find({ where: { providerId: PROVIDER_ID } });
    if (manifests.length > 0) {
      const manifestIds = manifests.map((m) => m.id);
      await dataSource
        .getRepository(ProviderCertificationRecord)
        .createQueryBuilder()
        .delete()
        .where('"manifestId" IN (:...ids)', { ids: manifestIds })
        .execute();
      await dataSource
        .getRepository(ProviderApprovalRecord)
        .createQueryBuilder()
        .delete()
        .where('"manifestId" IN (:...ids)', { ids: manifestIds })
        .execute();
      await dataSource
        .getRepository(ProviderPromotionManifest)
        .delete({ providerId: PROVIDER_ID });
    }
    await dataSource.destroy();
  }

  console.log('');
  if (passed) {
    console.log(
      'KILL-SWITCH DRILL PASSED: default-deny held before activation, dispatch worked once active, and the kill switch blocked the very next dispatch attempt.',
    );
  } else {
    console.log('KILL-SWITCH DRILL FAILED: see the FAILED step above.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('kill-switch-drill crashed:', error);
  process.exit(1);
});
