import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuthContext } from './auth-context';
import { RequireRole } from './require-role.decorator';
import { RoleGuard } from './role.guard';

function contextFor(
  authContext: AuthContext | undefined,
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  const request: { authContext?: AuthContext } = { authContext };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  const guard = new RoleGuard(new Reflector());

  // Real @RequireRole(...)-decorated handler references, not a fabricated
  // metadata object — SetMetadata attaches to the actual function, the
  // same thing Nest itself would look up at request time.
  class Fixture {
    @RequireRole(ApiClientRole.REVIEWER)
    reviewerOnly() {}

    @RequireRole(ApiClientRole.REVIEWER, ApiClientRole.PARTNER)
    eitherRole() {}

    noRequirement() {}
  }
  const fixture = new Fixture();

  it('allows a request whose role is in the required set', () => {
    const context = contextFor(
      { tenantId: 'x', apiClientId: 'y', role: ApiClientRole.REVIEWER },
      fixture.reviewerOnly,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request whose role is not in the required set, with a 403 naming the required role', () => {
    const context = contextFor(
      { tenantId: 'x', apiClientId: 'y', role: ApiClientRole.PARTNER },
      fixture.reviewerOnly,
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(/REVIEWER/);
  });

  it('allows either role when the route requires more than one', () => {
    const context = contextFor(
      { tenantId: 'x', apiClientId: 'y', role: ApiClientRole.PARTNER },
      fixture.eitherRole,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows every role through on a route with no @RequireRole metadata at all', () => {
    const context = contextFor(
      { tenantId: 'x', apiClientId: 'y', role: ApiClientRole.PARTNER },
      fixture.noRequirement,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws a plain programming-error Error, not a caller-facing exception, if used without ApiKeyGuard populating authContext first', () => {
    const context = contextFor(undefined, fixture.reviewerOnly);
    expect(() => guard.canActivate(context)).toThrow(
      'RoleGuard used without ApiKeyGuard',
    );
  });
});
