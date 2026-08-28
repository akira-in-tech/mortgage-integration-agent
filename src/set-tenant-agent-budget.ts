import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { Tenant } from './database/entities/tenant.entity';

/**
 * `npm run set-tenant-agent-budget -- <tenantId> <stepBudget|clear> <durationBudgetMs|clear>`
 * — M5-021's tenant-owned Agent run budget configuration. No REST
 * endpoint exists for this (the same honest gap `create-api-client.ts`
 * already has for minting a credential — an endpoint that could change
 * a tenant's own operational limits would need its own authorization
 * story this codebase's two-role RBAC, M5-017, doesn't cover). Pass the
 * literal string `clear` for either value to remove that override and
 * fall back to the platform default again.
 */
async function main(): Promise<void> {
  const [tenantId, stepBudgetArg, durationBudgetMsArg] = process.argv.slice(2);
  if (!tenantId || !stepBudgetArg || !durationBudgetMsArg) {
    console.error(
      'Usage: npm run set-tenant-agent-budget -- <tenantId> <stepBudget|clear> <durationBudgetMs|clear>',
    );
    process.exit(1);
  }

  function parseOverride(arg: string, name: string): number | null {
    if (arg === 'clear') return null;
    const value = Number(arg);
    if (!Number.isInteger(value) || value <= 0) {
      console.error(
        `${name} must be a positive integer, or the literal "clear"`,
      );
      process.exit(1);
    }
    return value;
  }

  const agentRunStepBudgetOverride = parseOverride(stepBudgetArg, 'stepBudget');
  const agentRunDurationBudgetMsOverride = parseOverride(
    durationBudgetMsArg,
    'durationBudgetMs',
  );

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [Tenant],
  });
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(Tenant);
    const result = await repo.update(
      { id: tenantId },
      { agentRunStepBudgetOverride, agentRunDurationBudgetMsOverride },
    );
    if (result.affected === 0) {
      console.error(`No tenant found with id ${tenantId}`);
      process.exit(1);
    }
    const tenant = await repo.findOneByOrFail({ id: tenantId });
    console.log(
      `Tenant ${tenantId} agent run budget: stepBudget=${tenant.agentRunStepBudgetOverride ?? '(platform default)'}, durationBudgetMs=${tenant.agentRunDurationBudgetMsOverride ?? '(platform default)'}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('set-tenant-agent-budget failed:', error);
  process.exit(1);
});
