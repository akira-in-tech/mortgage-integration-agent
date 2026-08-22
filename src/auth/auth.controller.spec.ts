import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const tenantDirectory = { listForUser: jest.fn() };
  const oidcSessionService = {
    authenticateCookie: jest.fn(),
    logout: jest.fn(),
  };
  const controller = new AuthController(
    tenantDirectory as never,
    oidcSessionService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('scopes membership discovery to the guard-issued user id', async () => {
    tenantDirectory.listForUser.mockResolvedValue([]);
    await controller.listMyTenants({
      oidcIdentity: {
        userId: 'verified-user',
        subject: 'issuer-subject',
        email: 'reviewer@example.com',
      },
    } as never);
    expect(tenantDirectory.listForUser).toHaveBeenCalledWith('verified-user');
  });

  it('fails closed if invoked without the guard-issued identity context', () => {
    expect(() => controller.listMyTenants({} as never)).toThrow(
      UnauthorizedException,
    );
    expect(tenantDirectory.listForUser).not.toHaveBeenCalled();
  });

  it('returns an unauthenticated status without leaking session failure detail', async () => {
    oidcSessionService.authenticateCookie.mockRejectedValue(
      new UnauthorizedException(),
    );

    await expect(
      controller.getSession({} as never, {} as never),
    ).resolves.toEqual({
      authenticated: false,
      memberships: [],
    });
  });
});
