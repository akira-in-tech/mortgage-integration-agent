import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { ApiClient } from './database/entities/api-client.entity';
import { ApiClientRole } from './database/enums/api-client.enum';
import { ApiClientService } from './auth/api-client.service';

/**
 * `npm run create-api-client -- <tenantId> <name> [role]` — the only way
 * to mint a Section 20 M5 scoped API-client credential today (see
 * `ApiClientService`'s own comment for why there's no REST endpoint).
 * `role` defaults to `PARTNER` (M5-017) — pass `REVIEWER` for a
 * credential meant to submit review decisions (`POST .../reviews`).
 * Prints the raw bearer token exactly once; it is never retrievable again.
 */
async function main(): Promise<void> {
  const [tenantId, name, roleArg] = process.argv.slice(2);
  if (!tenantId || !name) {
    console.error(
      'Usage: npm run create-api-client -- <tenantId> <name> [PARTNER|REVIEWER]',
    );
    process.exit(1);
  }
  if (
    roleArg &&
    !Object.values(ApiClientRole).includes(roleArg as ApiClientRole)
  ) {
    console.error(
      `Invalid role "${roleArg}" — must be one of: ${Object.values(ApiClientRole).join(', ')}`,
    );
    process.exit(1);
  }
  const role = roleArg as ApiClientRole | undefined;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [ApiClient],
  });
  await dataSource.initialize();

  try {
    const service = new ApiClientService(dataSource.getRepository(ApiClient));
    const { client, token } = await service.create({ tenantId, name, role });
    console.log(
      `Created API client ${client.id} for tenant ${tenantId} (role=${client.role})`,
    );
    console.log('');
    console.log(`Bearer token (shown once — store it now):`);
    console.log(token);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('create-api-client failed:', error);
  process.exit(1);
});
