import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { PlatformAdmin } from './database/entities/platform-admin.entity';
import { PlatformAdminService } from './auth/platform-admin.service';

/**
 * `npm run create-platform-admin -- <name>` — the only way to mint a
 * platform-admin credential (see `PlatformAdminService`'s own comment for
 * why there's no REST endpoint). This credential can drive the provider
 * promotion chain across every tenant, so only run this for a real person
 * who should have that reach. Prints the raw bearer token exactly once;
 * it is never retrievable again.
 */
async function main(): Promise<void> {
  const [name] = process.argv.slice(2);
  if (!name) {
    console.error('Usage: npm run create-platform-admin -- <name>');
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
    entities: [PlatformAdmin],
  });
  await dataSource.initialize();

  try {
    const service = new PlatformAdminService(
      dataSource.getRepository(PlatformAdmin),
    );
    const { admin, token } = await service.create(name);
    console.log(`Created platform admin ${admin.id} (${admin.name})`);
    console.log('');
    console.log(`Bearer token (shown once — store it now):`);
    console.log(token);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('create-platform-admin failed:', error);
  process.exit(1);
});
