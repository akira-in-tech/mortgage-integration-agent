import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { OidcClaims } from './oidc.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reconciles an OIDC identity into the application's separate authorization
 * model. Existing users retain their operator-provisioned memberships. A
 * newly self-registered identity receives one empty tenant only, so a public
 * identity-provider account can never join a pre-existing tenant by guessing
 * an identifier or callback URL.
 */
@Injectable()
export class SelfServiceProvisioningService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async resolveUser(
    accessClaims: OidcClaims,
    identityClaims?: OidcClaims,
  ): Promise<User | null> {
    const existing = await this.dataSource
      .getRepository(User)
      .findOneBy({ subject: accessClaims.sub });
    if (existing) return existing;
    if (!this.isEnabled()) return null;
    if (!this.isProvisionable(accessClaims, identityClaims)) return null;

    const email = identityClaims.email.trim().toLowerCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        // A second callback can arrive while the first is still completing.
        // The subject's unique database constraint serializes that race; this
        // lookup handles the ordinary already-committed case without widening
        // any tenant lookup to a browser-supplied value.
        const concurrentUser = await manager.findOneBy(User, {
          subject: accessClaims.sub,
        });
        if (concurrentUser) return concurrentUser;

        const tenantRepository = manager.getRepository(Tenant);
        const userRepository = manager.getRepository(User);
        const membershipRepository = manager.getRepository(TenantMembership);
        const tenant = await tenantRepository.save(
          tenantRepository.create({ name: this.workspaceName() }),
        );
        const user = await userRepository.save(
          userRepository.create({ subject: accessClaims.sub, email }),
        );
        await membershipRepository.save(
          membershipRepository.create({
            tenantId: tenant.id,
            userId: user.id,
            // PARTNER is intentionally the least-privileged role currently in
            // the product. REVIEWER-only approvals remain unavailable until an
            // authorized operator grants that separate membership.
            role: ApiClientRole.PARTNER,
          }),
        );
        return user;
      });
    } catch (error) {
      // PostgreSQL's unique subject constraint resolves a rare pair of
      // simultaneous first callbacks. The losing transaction rolls back its
      // newly-created tenant, then resumes the user the winning transaction
      // committed instead of turning a harmless browser retry into a 500.
      if (!this.isUniqueViolation(error)) throw error;
      return this.dataSource.getRepository(User).findOneBy({
        subject: accessClaims.sub,
      });
    }
  }

  private isEnabled(): boolean {
    return this.configService.get<boolean>(
      'SELF_SERVICE_SIGNUP_ENABLED',
      false,
    );
  }

  private isProvisionable(
    accessClaims: OidcClaims,
    identityClaims: OidcClaims | undefined,
  ): identityClaims is OidcClaims & { email: string } {
    return Boolean(
      identityClaims &&
      identityClaims.sub === accessClaims.sub &&
      typeof identityClaims.email === 'string' &&
      identityClaims.email.length <= 320 &&
      EMAIL_PATTERN.test(identityClaims.email),
    );
  }

  private workspaceName(): string {
    // No email or other identity attribute enters tenant metadata. The random
    // suffix makes the human-facing label unique without creating PII in a
    // cross-tenant directory or audit export.
    return `Self-service workspace ${randomUUID().slice(0, 8)}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }
}
