import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { User } from './database/entities/user.entity';
import { TenantMembership } from './database/entities/tenant-membership.entity';
import { ApiClientRole } from './database/enums/api-client.enum';

const USAGE = `Usage:
  npm run manage-user -- create-user <subject> <email>
  npm run manage-user -- grant-membership <userId> <tenantId> <PARTNER|REVIEWER>
  npm run manage-user -- revoke-membership <userId> <tenantId>`;

/**
 * Section 14.1's `users`/`tenant_memberships` (M5-024) — OIDC-linked
 * human identity and role assignment. No REST endpoint creates either
 * (the same honest administrative-action gap `create-api-client.ts`
 * already has): granting a real human real tenant access is exactly the
 * kind of out-of-band, human-decided action that gap already names.
 * `<subject>` is the real OIDC `sub` claim from this codebase's own
 * configured issuer — `npm run manage-user -- create-user` never talks
 * to the issuer itself, it only records what a real login later needs to
 * match against.
 */
async function main(): Promise<void> {
  const [action, ...rest] = process.argv.slice(2);
  if (!action) {
    console.error(USAGE);
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
    entities: [User, TenantMembership],
  });
  await dataSource.initialize();

  try {
    if (action === 'create-user') {
      const [subject, email] = rest;
      if (!subject || !email) {
        console.error(USAGE);
        process.exit(1);
      }
      const user = await dataSource
        .getRepository(User)
        .save(dataSource.getRepository(User).create({ subject, email }));
      console.log(
        `Created user ${user.id} (subject=${subject}, email=${email})`,
      );
    } else if (action === 'grant-membership') {
      const [userId, tenantId, roleArg] = rest;
      if (!userId || !tenantId || !roleArg) {
        console.error(USAGE);
        process.exit(1);
      }
      if (!Object.values(ApiClientRole).includes(roleArg as ApiClientRole)) {
        console.error(
          `Invalid role "${roleArg}" — must be one of: ${Object.values(ApiClientRole).join(', ')}`,
        );
        process.exit(1);
      }
      await dataSource.getRepository(User).findOneByOrFail({ id: userId });
      const repo = dataSource.getRepository(TenantMembership);
      const existing = await repo.findOneBy({ tenantId, userId });
      const membership = await repo.save(
        repo.create({
          ...existing,
          tenantId,
          userId,
          role: roleArg as ApiClientRole,
        }),
      );
      console.log(
        `Granted user ${userId} role ${roleArg} in tenant ${tenantId} (membership ${membership.id})`,
      );
    } else if (action === 'revoke-membership') {
      const [userId, tenantId] = rest;
      if (!userId || !tenantId) {
        console.error(USAGE);
        process.exit(1);
      }
      const result = await dataSource
        .getRepository(TenantMembership)
        .delete({ tenantId, userId });
      if (!result.affected) {
        console.error(
          `No membership found for user ${userId} in tenant ${tenantId}`,
        );
        process.exit(1);
      }
      console.log(`Revoked user ${userId}'s membership in tenant ${tenantId}`);
    } else {
      console.error(USAGE);
      process.exit(1);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('manage-user failed:', error.message ?? error);
  process.exit(1);
});
