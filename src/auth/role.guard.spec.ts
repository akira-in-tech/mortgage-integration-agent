import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuthContext } from './auth-context';
import { RequireRole } from './require-role.decorator';
import { RoleGuard } from './role.guard';
import { AuditEventService } from '../audit/audit-event.service';

function contextFor(
  authContext: AuthContext | undefined,
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  const request: { authContext?: AuthContext } = { authContext };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ({ name: 'FixtureController' }),
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  const record = jest.fn().mockResolvedValue(undefined);
  const auditEventService = { record } as unknown as AuditEventService;
  const guard = new RoleGuard(new Reflector(), auditEventService);

  beforeEach(() => {
    record.mockClear();
  });

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

  it('allows a request whose role is in the required set', async () => {
    const context = contextFor(
      {
        tenantId: 'x',
        apiClientId: 'y',
        role: ApiClientRole.REVIEWER,
        correlationId: 'c',
      },
      fixture.reviewerOnly,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a request whose role is not in the required set, with a 403 naming the required role, and records an RBAC_REJECTED audit event first', async () => {
    const context = contextFor(
      {
        tenantId: 'tenant-x',
        apiClientId: 'client-y',
        role: ApiClientRole.PARTNER,
        correlationId: 'corr-1',
      },
      fixture.reviewerOnly,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(/REVIEWER/);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-x',
        actorId: 'client-y',
        action: 'RBAC_REJECTED',
        resourceType: 'route',
        resourceId: 'FixtureController.reviewerOnly',
        correlationId: 'corr-1',
      }),
    );
  });

  it('allows either role when the route requires more than one', async () => {
    const context = contextFor(
      {
        tenantId: 'x',
        apiClientId: 'y',
        role: ApiClientRole.PARTNER,
        correlationId: 'c',
      },
      fixture.eitherRole,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows every role through on a route with no @RequireRole metadata at all', async () => {
    const context = contextFor(
      {
        tenantId: 'x',
        apiClientId: 'y',
        role: ApiClientRole.PARTNER,
        correlationId: 'c',
      },
      fixture.noRequirement,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws a plain programming-error Error, not a caller-facing exception, if used without ApiKeyGuard populating authContext first', async () => {
    const context = contextFor(undefined, fixture.reviewerOnly);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'RoleGuard used without ApiKeyGuard',
    );
  });
});
