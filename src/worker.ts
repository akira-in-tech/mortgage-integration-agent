import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Worker, NativeConnection } from '@temporalio/worker';
import { join } from 'path';
import { WorkerModule } from './worker.module';
import { PlaidService } from './integrations/plaid/plaid.service';
import { CreditService } from './integrations/credit/credit.service';
import { DocumentService } from './integrations/document/document.service';
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
    plaidService: appContext.get(PlaidService),
    creditService: appContext.get(CreditService),
    documentService: appContext.get(DocumentService),
  });

  const connection = await NativeConnection.connect({
    address: configService.get<string>('TEMPORAL_ADDRESS', 'localhost:7233'),
  });

  const worker = await Worker.create({
    connection,
    namespace: configService.get<string>('TEMPORAL_NAMESPACE', 'default'),
    taskQueue: CASE_CONDITIONS_TASK_QUEUE,
    workflowsPath: join(__dirname, 'workflows', 'case-conditions.workflow.js'),
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
