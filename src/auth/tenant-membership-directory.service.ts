import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { ApiClientRole } from '../database/enums/api-client.enum';

export interface TenantMembershipSummary {
  tenantId: string;
  tenantName: string;
  role: ApiClientRole;
}

/**
 * Lists a verified user's own current memberships. `tenant_memberships` is
 * the authentication bootstrap table, so no tenant context exists yet and
 * RLS cannot be used for this lookup; scoping is instead the non-callable
 * `userId` taken from `OidcIdentityGuard`, never a request parameter.
 */
@Injectable()
export class TenantMembershipDirectoryService {
  constructor(
    @InjectRepository(TenantMembership)
    private readonly membershipRepository: Repository<TenantMembership>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async listForUser(userId: string): Promise<TenantMembershipSummary[]> {
    const memberships = await this.membershipRepository.findBy({ userId });
    if (memberships.length === 0) return [];

    const tenants = await this.tenantRepository.findBy({
      id: In(memberships.map((membership) => membership.tenantId)),
    });
    const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    return memberships
      .flatMap((membership) => {
        const tenant = tenantById.get(membership.tenantId);
        return tenant
          ? [
              {
                tenantId: tenant.id,
                tenantName: tenant.name,
                role: membership.role,
              },
            ]
          : [];
      })
      .sort(
        (left, right) =>
          left.tenantName.localeCompare(right.tenantName) ||
          left.tenantId.localeCompare(right.tenantId),
      );
  }
}
