import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Worker, NativeConnection } from '@temporalio/worker';
import { WorkerModule } from './worker.module';
import { CreditService } from './integrations/credit/credit.service';
import { DocumentService } from './integrations/document/document.service';
import { PolicyEvaluationService } from './policy/policy-evaluation.service';
import { EvaluationManifestService } from './policy/evaluation-manifest.service';
import { ProviderRegistryService } from './provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from './provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';
import { createCaseConditionsActivities } from './workflows/case-conditions.activities';
import { CASE_CONDITIONS_TASK_QUEUE } from './workflows/case-conditions.signals';

async function bootstrap(): Promise<void> {
  // A plain Nest application context, not createApplicationContext + an
  // HTTP listener — this process never serves requests, it only resolves
  // the same DI-managed services activities need (Section 12.1).
  const appContext = await NestFactory.createApplicationContext(WorkerModule);
  const configService = appContext.get(ConfigService);

  const activities = createCaseConditionsActivities({
    dataSource: appContext.get(DataSource),
    creditService: appContext.get(CreditService),
    documentService: appContext.get(DocumentService),
    policyEvaluationService: appContext.get(PolicyEvaluationService),
    evaluationManifestService: appContext.get(EvaluationManifestService),
    providerRegistry: appContext.get(ProviderRegistryService),
    providerAuthorizationService: appContext.get(ProviderAuthorizationService),
    providerOperationIntentService: appContext.get(
      ProviderOperationIntentService,
    ),
    outboxSigningSecret: configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    ),
  });

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
    await connection.close();
    await appContext.close();
  }
}

bootstrap().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
