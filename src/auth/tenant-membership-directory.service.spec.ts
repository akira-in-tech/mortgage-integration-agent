import { ApiClientRole } from '../database/enums/api-client.enum';
import { TenantMembershipDirectoryService } from './tenant-membership-directory.service';

describe('TenantMembershipDirectoryService', () => {
  const membershipRepository = { findBy: jest.fn() };
  const tenantRepository = { findBy: jest.fn() };
  const service = new TenantMembershipDirectoryService(
    membershipRepository as never,
    tenantRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns only the verified user memberships with tenant names and roles', async () => {
    membershipRepository.findBy.mockResolvedValue([
      { tenantId: 'tenant-b', userId: 'user-1', role: ApiClientRole.PARTNER },
      { tenantId: 'tenant-a', userId: 'user-1', role: ApiClientRole.REVIEWER },
    ]);
    tenantRepository.findBy.mockResolvedValue([
      { id: 'tenant-a', name: 'Atlas Lending' },
      { id: 'tenant-b', name: 'Beacon Credit' },
    ]);

    await expect(service.listForUser('user-1')).resolves.toEqual([
      {
        tenantId: 'tenant-a',
        tenantName: 'Atlas Lending',
        role: ApiClientRole.REVIEWER,
      },
      {
        tenantId: 'tenant-b',
        tenantName: 'Beacon Credit',
        role: ApiClientRole.PARTNER,
      },
    ]);
    expect(membershipRepository.findBy).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('returns an empty list without querying tenants when the user has no memberships', async () => {
    membershipRepository.findBy.mockResolvedValue([]);
    await expect(service.listForUser('user-1')).resolves.toEqual([]);
    expect(tenantRepository.findBy).not.toHaveBeenCalled();
  });

  it('does not fabricate a tenant when a dangling membership cannot resolve its tenant', async () => {
    membershipRepository.findBy.mockResolvedValue([
      {
        tenantId: 'missing-tenant',
        userId: 'user-1',
        role: ApiClientRole.REVIEWER,
      },
    ]);
    tenantRepository.findBy.mockResolvedValue([]);
    await expect(service.listForUser('user-1')).resolves.toEqual([]);
  });
});
