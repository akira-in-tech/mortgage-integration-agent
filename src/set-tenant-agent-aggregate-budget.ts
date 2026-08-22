import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { Tenant } from './database/entities/tenant.entity';

/**
 * Operator-only bootstrap for monthly cost-bearing Agent authority. The public
 * API intentionally has no budget-administration route because the current
 * PARTNER/REVIEWER roles do not grant organization-administrator authority.
 */
async function main(): Promise<void> {
  const [tenantId, providerCallsArg, costArg, currencyArg] =
    process.argv.slice(2);
  if (!tenantId || !providerCallsArg || !costArg || !currencyArg) {
    console.error(
      'Usage: npm run set-tenant-agent-aggregate-budget -- <tenantId> <monthlyProviderCalls|disabled> <monthlyCostMinorUnits|disabled> <currency|disabled>',
    );
    process.exit(1);
  }

  const disabled =
    providerCallsArg === 'disabled' &&
    costArg === 'disabled' &&
    currencyArg === 'disabled';
  const partiallyDisabled =
    !disabled && [providerCallsArg, costArg, currencyArg].includes('disabled');
  if (partiallyDisabled) {
    console.error(
      'Aggregate budget fields must be enabled or disabled together.',
    );
    process.exit(1);
  }

  const providerCallLimit = disabled ? null : Number(providerCallsArg);
  const costLimitMinorUnits = disabled ? null : Number(costArg);
  const currency = disabled ? null : currencyArg;
  if (
    !disabled &&
    (!Number.isSafeInteger(providerCallLimit) ||
      (providerCallLimit as number) < 0 ||
      !Number.isSafeInteger(costLimitMinorUnits) ||
      (costLimitMinorUnits as number) < 0 ||
      !/^[A-Z]{3}$/.test(currency as string))
  ) {
    console.error(
      'Limits must be nonnegative safe integers and currency must be three uppercase letters.',
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
    entities: [Tenant],
  });
  await dataSource.initialize();
  try {
    const result = await dataSource.getRepository(Tenant).update(
      { id: tenantId },
      {
        agentMonthlyProviderCallLimit: providerCallLimit,
        agentMonthlyCostLimitMinorUnits: costLimitMinorUnits,
        agentBudgetCurrency: currency,
      },
    );
    if (result.affected === 0) {
      console.error(`No tenant found with id ${tenantId}`);
      process.exit(1);
    }
    console.log(
      disabled
        ? `Tenant ${tenantId} cost-bearing Agent work is disabled.`
        : `Tenant ${tenantId} monthly Agent budget: providerCalls=${providerCallLimit}, costMinorUnits=${costLimitMinorUnits}, currency=${currency}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('set-tenant-agent-aggregate-budget failed:', error);
  process.exit(1);
});
