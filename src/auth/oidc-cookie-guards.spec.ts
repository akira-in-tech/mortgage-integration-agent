import { ExecutionContext } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { OidcGuard } from './oidc.guard';
import { OidcIdentityGuard } from './oidc-identity.guard';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USER = {
  id: '20000000-0000-4000-8000-000000000002',
  subject: 'issuer-subject',
  email: 'reviewer@example.com',
};

function contextFor(method = 'GET'): {
  context: ExecutionContext;
  request: {
    method: string;
    headers: Record<string, string>;
    authContext?: unknown;
    oidcIdentity?: unknown;
  };
  response: object;
} {
  const request = {
    method,
    headers: { 'x-tenant-id': TENANT_ID },
  };
  const response = {};
  return {
    context: {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext,
    request,
    response,
  };
}

describe('OIDC cookie guards', () => {
  const oidcService = { verify: jest.fn() };
  const userRepository = { findOneBy: jest.fn() };
  const membershipRepository = { findOneBy: jest.fn() };
  const sessionService = { authenticateCookie: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.authenticateCookie.mockResolvedValue({
      user: USER,
      claims: { sub: USER.subject },
      csrfToken: 'csrf-token',
    });
    membershipRepository.findOneBy.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: USER.id,
      role: ApiClientRole.REVIEWER,
    });
  });

  it('uses the durable cookie session and requires CSRF for a GraphQL POST', async () => {
    const guard = new OidcGuard(
      oidcService as never,
      userRepository as never,
      membershipRepository as never,
      sessionService as never,
    );
    const { context, request, response } = contextFor('POST');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionService.authenticateCookie).toHaveBeenCalledWith(
      request,
      response,
      true,
    );
    expect(oidcService.verify).not.toHaveBeenCalled();
    expect(request.authContext).toMatchObject({
      tenantId: TENANT_ID,
      actorId: USER.id,
      role: ApiClientRole.REVIEWER,
    });
  });

  it('resolves pre-tenant identity from the cookie without granting authority', async () => {
    const guard = new OidcIdentityGuard(
      oidcService as never,
      userRepository as never,
      sessionService as never,
    );
    const { context, request, response } = contextFor();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionService.authenticateCookie).toHaveBeenCalledWith(
      request,
      response,
      false,
    );
    expect(request.oidcIdentity).toEqual({
      userId: USER.id,
      subject: USER.subject,
      email: USER.email,
    });
    expect(request.authContext).toBeUndefined();
  });
});
