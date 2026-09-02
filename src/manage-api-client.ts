import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { ApiClient } from './database/entities/api-client.entity';
import { ApiClientService } from './auth/api-client.service';

/**
 * Performs the operational lifecycle actions that must not be exposed as a
 * self-service tenant API. A caller receives a replacement secret exactly
 * once; command output is intentionally limited to client metadata plus that
 * one enrollment value, never a stored secret hash.
 */
async function main(): Promise<void> {
  const [action, clientId] = process.argv.slice(2);
  if (!['rotate', 'revoke'].includes(action) || !clientId) {
    console.error(
      'Usage: npm run manage-api-client -- <rotate|revoke> <apiClientId>',
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
    entities: [ApiClient],
  });
  await dataSource.initialize();

  try {
    const service = new ApiClientService(dataSource.getRepository(ApiClient));
    if (action === 'rotate') {
      const { client, token } = await service.rotate(clientId);
      console.log(`Rotated API client ${client.id} (role=${client.role}).`);
      console.log('Bearer token (shown once — store it now):');
      console.log(token);
      return;
    }

    const client = await service.revoke(clientId);
    console.log(`Revoked API client ${client.id}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('manage-api-client failed:', error);
  process.exit(1);
});
