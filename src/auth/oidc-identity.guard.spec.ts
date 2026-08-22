import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OidcIdentityGuard } from './oidc-identity.guard';

function contextFor(authorization?: string) {
  const request: {
    headers: Record<string, string>;
    oidcIdentity?: {
      userId: string;
      subject: string;
      email: string;
    };
  } = { headers: {} };
  if (authorization) request.headers.authorization = authorization;
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('OidcIdentityGuard', () => {
  const oidcService = { verify: jest.fn() };
  const userRepository = { findOneBy: jest.fn() };
  const guard = new OidcIdentityGuard(
    oidcService as never,
    userRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('attaches only the verified human identity and requires no tenant header', async () => {
    oidcService.verify.mockResolvedValue({ sub: 'issuer-subject' });
    userRepository.findOneBy.mockResolvedValue({
      id: 'user-1',
      subject: 'issuer-subject',
      email: 'reviewer@example.com',
    });
    const { context, request } = contextFor('Bearer real-jwt');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(oidcService.verify).toHaveBeenCalledWith('real-jwt');
    expect(request.oidcIdentity).toEqual({
      userId: 'user-1',
      subject: 'issuer-subject',
      email: 'reviewer@example.com',
    });
    expect(request.oidcIdentity).not.toHaveProperty('tenantId');
    expect(request.oidcIdentity).not.toHaveProperty('role');
  });

  it('fails closed when no bearer token is present', async () => {
    const { context } = contextFor();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(oidcService.verify).not.toHaveBeenCalled();
  });

  it('fails closed when the verified subject is not provisioned', async () => {
    oidcService.verify.mockResolvedValue({ sub: 'unknown-subject' });
    userRepository.findOneBy.mockResolvedValue(null);
    const { context } = contextFor('Bearer real-jwt');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
