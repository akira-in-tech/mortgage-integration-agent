import {
  getTemporalTelemetryPlugins,
  shutdownTelemetry,
} from './instrumentation';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Worker, NativeConnection } from '@temporalio/worker';
import { WorkerModule } from './worker.module';
import { PolicyEvaluationService } from './policy/policy-evaluation.service';
import { EvaluationManifestService } from './policy/evaluation-manifest.service';
import { ProviderRegistryService } from './provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from './provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';
import { ProviderKillSwitchService } from './provider-platform/provider-kill-switch.service';
import { ProviderPromotionService } from './provider-platform/provider-promotion.service';
import { ProviderReconciliationService } from './provider-platform/provider-reconciliation.service';
import { PolicySourceMonitorService } from './policy/policy-source-monitor.service';
import { PolicyResearchService } from './policy/policy-research.service';
import {
  DemoPolicySourceConnector,
  fetchDemoBulletin,
} from './policy/policy-source-connector';
import { PolicySource } from './database/entities/policy-source.entity';
import { createCaseConditionsActivities } from './workflows/case-conditions.activities';
import { CASE_CONDITIONS_TASK_QUEUE } from './workflows/case-conditions.signals';
import { WebhookDispatchService } from './webhooks/webhook-dispatch.service';
import { ConsentService } from './consent/consent.service';
import { CommunicationMessageService } from './communications/communication-message.service';
import { CommunicationDeliveryService } from './communications/communication-delivery.service';
import { DecisionProvider, NodeEnvironment } from './config/env.validation';
import { OllamaAgentPlanner } from './agent-runtime/agent-planner';
import { GuestSandboxService } from './auth/guest-sandbox.service';
import {
  describeTenantIsolationRlsGaps,
  findTenantIsolationRlsGaps,
} from './database/check-tenant-isolation-rls';

async function bootstrap(): Promise<void> {
  // A plain Nest application context, not createApplicationContext + an
  // HTTP listener — this process never serves requests, it only resolves
  // the same DI-managed services activities need (Section 12.1).
  const appContext = await NestFactory.createApplicationContext(WorkerModule);
  const configService = appContext.get(ConfigService);
  const nodeEnv = configService.get<NodeEnvironment>(
    'NODE_ENV',
    NodeEnvironment.Development,
  );

  // M7-055: same check main.ts runs before the API accepts traffic — see
  // that call site's own comment for the real gap this closes. The worker
  // writes to the same tenant-scoped tables (webhook dispatch, provider
  // reconciliation, guest-sandbox cleanup), so it needs the same guard.
  const rlsGaps = await findTenantIsolationRlsGaps(appContext.get(DataSource));
  if (rlsGaps.length > 0) {
    const lines = describeTenantIsolationRlsGaps(rlsGaps);
    if (
      nodeEnv === NodeEnvironment.Staging ||
      nodeEnv === NodeEnvironment.Production
    ) {
      throw new Error(
        `Refusing to start in ${nodeEnv}: tenant isolation (row-level security) is missing on ${rlsGaps.length} table(s): ${lines.join('; ')}. Run the real migration chain (npm run migration:run) against this database, not a synchronize-built schema.`,
      );
    }
    console.warn(
      `WARNING: row-level security is missing on ${rlsGaps.length} tenant-scoped table(s) — tenant isolation fails open on this database: ${lines.join('; ')}. This is a known local-dev quirk when the schema was built via synchronize instead of "npm run migration:run" — fine for casual local development, but never trust cross-tenant test results against this database until it's fixed.`,
    );
  }

  const agentPlanner =
    configService.get<DecisionProvider>(
      'DECISION_PROVIDER',
      DecisionProvider.Rules,
    ) === DecisionProvider.Ollama
      ? new OllamaAgentPlanner({
          baseUrl: configService.get<string>(
            'OLLAMA_BASE_URL',
            'http://127.0.0.1:11434',
          ),
          model: configService.get<string>('OLLAMA_MODEL', 'qwen3.5:9b'),
          timeoutMs: configService.get<number>('OLLAMA_TIMEOUT_MS', 60_000),
          maxOutputTokens: configService.get<number>(
            'AGENT_PLANNER_MAX_OUTPUT_TOKENS',
            128,
          ),
          tokenBudgetUnits: configService.get<number>(
            'AGENT_PLANNER_TOKEN_BUDGET',
            1024,
          ),
          minimumConfidenceBasisPoints: configService.get<number>(
            'AGENT_PLANNER_MIN_CONFIDENCE_BPS',
            8000,
          ),
        })
      : undefined;

  const activities = createCaseConditionsActivities({
    dataSource: appContext.get(DataSource),
    policyEvaluationService: appContext.get(PolicyEvaluationService),
    evaluationManifestService: appContext.get(EvaluationManifestService),
    providerRegistry: appContext.get(ProviderRegistryService),
    providerAuthorizationService: appContext.get(ProviderAuthorizationService),
    providerOperationIntentService: appContext.get(
      ProviderOperationIntentService,
    ),
    providerKillSwitchService: appContext.get(ProviderKillSwitchService),
    providerPromotionService: appContext.get(ProviderPromotionService),
    consentService: appContext.get(ConsentService),
    messageService: appContext.get(CommunicationMessageService),
    communicationDeliveryService: appContext.get(CommunicationDeliveryService),
    agentPlanner,
    outboxSigningSecret: configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    ),
  });

  // Section 12.1's Worker service scope: "webhook delivery." Not a
  // Temporal workflow/activity — a `WebhookDelivery` row is already the
  // durable record of what's been attempted and what's still due, so a
  // crash between polls loses nothing; the next poll just picks it back
  // up (see WebhookDispatchService's own class comment).
  const webhookDispatchService = appContext.get(WebhookDispatchService);
  const webhookDispatchIntervalMs = configService.get<number>(
    'WEBHOOK_DISPATCH_INTERVAL_MS',
    5000,
  );
  const webhookDispatchTimer = setInterval(() => {
    webhookDispatchService.dispatchPendingEvents().catch((error) => {
      console.error('Webhook dispatch tick failed:', error);
    });
  }, webhookDispatchIntervalMs);

  // Section 11.5's reconciliation sweep (M5-027) — same "plain interval,
  // not a Temporal workflow" reasoning as webhook dispatch above.
  const providerReconciliationService = appContext.get(
    ProviderReconciliationService,
  );
  const providerReconciliationIntervalMs = configService.get<number>(
    'PROVIDER_RECONCILIATION_INTERVAL_MS',
    60_000,
  );
  const providerReconciliationStaleAfterMs = configService.get<number>(
    'PROVIDER_RECONCILIATION_STALE_AFTER_MS',
    300_000,
  );
  const providerReconciliationTimer = setInterval(() => {
    providerReconciliationService
      .reconcilePendingIntents(providerReconciliationStaleAfterMs)
      .catch((error) => {
        console.error('Provider reconciliation tick failed:', error);
      });
  }, providerReconciliationIntervalMs);

  // Section 29 item 4's monitoring mechanism (M7-027) - same "plain
  // interval, not a Temporal workflow" reasoning as the two timers
  // above. Looked up by jurisdictionCode rather than a hardcoded id so
  // this doesn't silently do nothing if the demo migration hasn't run
  // in a given environment; it just logs once and skips scheduling.
  const policySourceRepository = appContext
    .get(DataSource)
    .getRepository(PolicySource);
  const demoPolicySource = await policySourceRepository.findOneBy({
    jurisdictionCode: 'US-DEMO',
  });
  let policySourceMonitorTimer: NodeJS.Timeout | undefined;
  if (demoPolicySource) {
    const policySourceMonitorService = appContext.get(
      PolicySourceMonitorService,
    );
    const demoConnector = new DemoPolicySourceConnector(
      demoPolicySource.id,
      fetchDemoBulletin,
    );
    const policySourceMonitorIntervalMs = configService.get<number>(
      'POLICY_SOURCE_MONITOR_INTERVAL_MS',
      3_600_000,
    );
    policySourceMonitorTimer = setInterval(() => {
      policySourceMonitorService.checkSource(demoConnector).catch((error) => {
        console.error('Policy source monitor tick failed:', error);
      });
    }, policySourceMonitorIntervalMs);
  } else {
    console.warn(
      'No US-DEMO policy source found - skipping the policy source monitor (run the PolicySourceConnectorDemo migration to enable it).',
    );
  }

  // Policy discovery has a durable database queue, separate from policy
  // evaluation. A timer is sufficient here because `claimNextRun()` uses
  // SKIP LOCKED; a restart leaves QUEUED work intact and a second worker
  // cannot synthesize the same item concurrently.
  const policyResearchService = appContext.get(PolicyResearchService);
  const policyResearchIntervalMs = configService.get<number>(
    'POLICY_RESEARCH_INTERVAL_MS',
    300_000,
  );
  const processPolicyResearch = () =>
    policyResearchService.processPendingRuns().catch((error) => {
      console.error('Policy research tick failed:', error);
    });
  processPolicyResearch();
  const policyResearchTimer = setInterval(
    processPolicyResearch,
    policyResearchIntervalMs,
  );

  // M7-055: the guest sandbox's own session-expiry sweep used to run only
  // opportunistically, inside create() itself, so cleanup couldn't outpace
  // creation under sustained traffic to that public, unauthenticated
  // endpoint - real orphaned tenants/cases/consent rows accumulated in real
  // staging RDS forever. Same "plain interval, not a Temporal workflow"
  // reasoning as the timers above; create() keeps its own opportunistic
  // call too, as a fallback for any environment not running this process.
  const guestSandboxService = appContext.get(GuestSandboxService);
  const guestSandboxCleanupIntervalMs = configService.get<number>(
    'GUEST_SANDBOX_CLEANUP_INTERVAL_MS',
    300_000,
  );
  const guestSandboxCleanupTimer = setInterval(() => {
    guestSandboxService.purgeExpiredSessions().catch((error) => {
      console.error('Guest sandbox cleanup tick failed:', error);
    });
  }, guestSandboxCleanupIntervalMs);

  const connection = await NativeConnection.connect({
    address: configService.get<string>('TEMPORAL_ADDRESS', 'localhost:7233'),
  });

  const worker = await Worker.create({
    connection,
    namespace: configService.get<string>('TEMPORAL_NAMESPACE', 'default'),
    taskQueue: CASE_CONDITIONS_TASK_QUEUE,
    // require.resolve, not a hardcoded `.js` join(__dirname, ...) path: the
    // latter only exists under the compiled dist/ output (`npm run
    // start:worker`) and throws ENOENT under `npm run start:worker:dev`'s
    // direct ts-node execution against src/, where only the .ts file
    // exists — this needs to resolve correctly under both. Same pattern
    // already proven working in case-conditions.workflow.spec.ts.
    workflowsPath: require.resolve('./workflows/case-conditions.workflow'),
    activities,
    plugins: getTemporalTelemetryPlugins(),
  });

  console.log(
    `Temporal worker running [taskQueue=${CASE_CONDITIONS_TASK_QUEUE}]`,
  );

  const shutdown = () => {
    console.log('Worker shutting down...');
    worker.shutdown();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    await worker.run();
  } finally {
    clearInterval(webhookDispatchTimer);
    clearInterval(providerReconciliationTimer);
    clearInterval(policyResearchTimer);
    clearInterval(guestSandboxCleanupTimer);
    if (policySourceMonitorTimer) {
      clearInterval(policySourceMonitorTimer);
    }
    await connection.close();
    await appContext.close();
    await shutdownTelemetry();
  }
}

bootstrap().catch((error) => {
  console.error('Worker failed to start:', error);
  void shutdownTelemetry().finally(() => {
    process.exitCode = 1;
  });
});
