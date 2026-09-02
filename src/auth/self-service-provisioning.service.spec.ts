import { ConfigService } from '@nestjs/config';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { SelfServiceProvisioningService } from './self-service-provisioning.service';

describe('SelfServiceProvisioningService', () => {
  const existingUser = {
    id: '10000000-0000-4000-8000-000000000001',
    subject: 'existing-subject',
    email: 'existing@example.test',
  };
  let existing: typeof existingUser | null;
  let dataSource: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };

  function service(enabled: boolean): SelfServiceProvisioningService {
    return new SelfServiceProvisioningService(
      new ConfigService({ SELF_SERVICE_SIGNUP_ENABLED: enabled }),
      dataSource as never,
    );
  }

  beforeEach(() => {
    existing = null;
    const saved: Record<string, unknown>[] = [];
    const tenantRepository = {
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => ({
        id: '20000000-0000-4000-8000-000000000002',
        ...value,
      })),
    };
    const userRepository = {
      findOneBy: jest.fn(async () => existing),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => ({
        id: '30000000-0000-4000-8000-000000000003',
        ...value,
      })),
    };
    const membershipRepository = {
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => {
        saved.push(value);
        return value;
      }),
    };
    dataSource = {
      getRepository: jest.fn(() => userRepository),
      transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
        callback({
          findOneBy: userRepository.findOneBy,
          getRepository: jest.fn((entity: { name: string }) => {
            if (entity.name === 'Tenant') return tenantRepository;
            if (entity.name === 'User') return userRepository;
            return membershipRepository;
          }),
        }),
      ),
    };
    // Keep the membership fixture observable without exposing mutable service
    // state to production code.
    Object.assign(dataSource, { saved });
  });

  it('keeps an existing operator-provisioned user unchanged', async () => {
    existing = existingUser;

    await expect(
      service(true).resolveUser({ sub: existingUser.subject }),
    ).resolves.toEqual(existingUser);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('fails closed for an unprovisioned identity when signup is disabled', async () => {
    await expect(
      service(false).resolveUser(
        { sub: 'new-subject' },
        { sub: 'new-subject', email: 'new@example.test' },
      ),
    ).resolves.toBeNull();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('provisions one isolated PARTNER workspace from a matching verified email', async () => {
    const user = await service(true).resolveUser(
      { sub: 'new-subject' },
      { sub: 'new-subject', email: 'New.User@example.test' },
    );

    expect(user).toMatchObject({
      subject: 'new-subject',
      email: 'new.user@example.test',
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(
      (dataSource as typeof dataSource & { saved: unknown[] }).saved,
    ).toEqual([
      {
        tenantId: '20000000-0000-4000-8000-000000000002',
        userId: '30000000-0000-4000-8000-000000000003',
        role: ApiClientRole.PARTNER,
      },
    ]);
  });

  it('rejects an ID token that does not belong to the authenticated subject', async () => {
    await expect(
      service(true).resolveUser(
        { sub: 'new-subject' },
        { sub: 'other-subject', email: 'new@example.test' },
      ),
    ).resolves.toBeNull();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
