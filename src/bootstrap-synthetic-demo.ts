import { DataSource } from 'typeorm';
import { Tenant } from './database/entities/tenant.entity';
import { User } from './database/entities/user.entity';
import { TenantMembership } from './database/entities/tenant-membership.entity';
import { ApiClientRole } from './database/enums/api-client.enum';

const SYNTHETIC_TENANT_NAME = 'Synthetic Staging Lending Operations';

/**
 * Creates the one explicitly synthetic reviewer membership used by the AWS
 * staging walkthrough. This is an operator task, not a public API: it refuses
 * every environment except an explicitly marked staging bootstrap and never
 * prints credentials. Re-running it reconciles the same user and membership
 * rather than accumulating demo identities.
 */
async function main(): Promise<void> {
  if (
    process.env.NODE_ENV !== 'staging' ||
    process.env.SYNTHETIC_DEMO_BOOTSTRAP !== 'true'
  ) {
    throw new Error('Synthetic demo bootstrap is permitted only in staging.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const subject = process.env.DEMO_OIDC_SUBJECT;
  const email = process.env.DEMO_OIDC_EMAIL;
  if (!databaseUrl || !subject || !email) {
    throw new Error(
      'DATABASE_URL, DEMO_OIDC_SUBJECT, and DEMO_OIDC_EMAIL are required.',
    );
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [Tenant, User, TenantMembership],
  });
  await dataSource.initialize();
  try {
    const tenantRepository = dataSource.getRepository(Tenant);
    const userRepository = dataSource.getRepository(User);
    const membershipRepository = dataSource.getRepository(TenantMembership);

    let tenant = await tenantRepository.findOneBy({
      name: SYNTHETIC_TENANT_NAME,
    });
    if (!tenant) {
      tenant = await tenantRepository.save(
        tenantRepository.create({ name: SYNTHETIC_TENANT_NAME }),
      );
    }

    let user = await userRepository.findOneBy({ subject });
    if (!user) {
      user = await userRepository.save(
        userRepository.create({ subject, email }),
      );
    } else if (user.email !== email) {
      user.email = email;
      user = await userRepository.save(user);
    }

    const membership = await membershipRepository.findOneBy({
      tenantId: tenant.id,
      userId: user.id,
    });
    if (!membership) {
      await membershipRepository.save(
        membershipRepository.create({
          tenantId: tenant.id,
          userId: user.id,
          role: ApiClientRole.REVIEWER,
        }),
      );
    } else if (membership.role !== ApiClientRole.REVIEWER) {
      membership.role = ApiClientRole.REVIEWER;
      await membershipRepository.save(membership);
    }

    console.log(`Synthetic staging reviewer is ready for tenant ${tenant.id}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('bootstrap-synthetic-demo failed:', error);
  process.exit(1);
});
