import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { ProviderAdapterStatus } from './database/entities/provider-adapter-status.entity';
import { ProviderKillSwitchService } from './provider-platform/provider-kill-switch.service';
import { ProviderCapability, ProviderMode } from './provider-platform/types';

const VALID_MODES: ProviderMode[] = [
  'SIMULATOR',
  'AUTHORIZED_SANDBOX',
  'PRODUCTION_BYOC',
];

/**
 * `npm run set-provider-status -- <providerId> <capability> <mode> <enable|disable> <actorId> [reason]`
 * — Section 11.4's kill switch (M4-006). No REST endpoint exists for
 * this (the same honest gap `create-api-client.ts`/`set-tenant-agent-budget.ts`
 * already have — a platform-operational action this codebase's two-role
 * tenant RBAC has no admin tier for). `reason` is required for `disable`,
 * ignored for `enable`.
 */
async function main(): Promise<void> {
  const [providerId, capabilityArg, mode, action, actorId, ...reasonParts] =
    process.argv.slice(2);

  if (!providerId || !capabilityArg || !mode || !action || !actorId) {
    console.error(
      'Usage: npm run set-provider-status -- <providerId> <capability> <mode> <enable|disable> <actorId> [reason]',
    );
    process.exit(1);
  }
  if (
    !Object.values(ProviderCapability).includes(
      capabilityArg as ProviderCapability,
    )
  ) {
    console.error(
      `Invalid capability "${capabilityArg}" — must be one of: ${Object.values(ProviderCapability).join(', ')}`,
    );
    process.exit(1);
  }
  if (!VALID_MODES.includes(mode as ProviderMode)) {
    console.error(
      `Invalid mode "${mode}" — must be one of: ${VALID_MODES.join(', ')}`,
    );
    process.exit(1);
  }
  if (action !== 'enable' && action !== 'disable') {
    console.error('action must be "enable" or "disable"');
    process.exit(1);
  }
  const capability = capabilityArg as ProviderCapability;
  const validatedMode = mode as ProviderMode;
  const reason = reasonParts.join(' ').trim();
  if (action === 'disable' && !reason) {
    console.error('reason is required when disabling');
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
    entities: [ProviderAdapterStatus],
  });
  await dataSource.initialize();

  try {
    const service = new ProviderKillSwitchService(dataSource);
    if (action === 'disable') {
      await service.disable(
        providerId,
        capability,
        validatedMode,
        reason,
        actorId,
      );
      console.log(
        `provider ${providerId} capability=${capability} mode=${mode} is now DISABLED (reason: ${reason})`,
      );
    } else {
      await service.enable(providerId, capability, validatedMode, actorId);
      console.log(
        `provider ${providerId} capability=${capability} mode=${mode} is now ACTIVE`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('set-provider-status failed:', error);
  process.exit(1);
});
