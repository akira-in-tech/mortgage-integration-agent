import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { decodeJwt } from 'jose';
import { User } from '../database/entities/user.entity';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { OidcService } from './oidc.service';
import { OidcGuard } from './oidc.guard';
import { AuthContext } from './auth-context';

// Requires both a reachable Postgres and a reachable Keycloak (same
// convention as this codebase's other real-infrastructure specs): skip
// instead of failing when either is unconfigured.
const DATABASE_URL = process.env.DATABASE_URL;
const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL;
const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE ?? 'mortgage-agent-app';
const describeOrSkip =
  DATABASE_URL && OIDC_ISSUER_URL ? describe : describe.skip;

async function fetchRealToken(): Promise<string> {
  const response = await fetch(
    `${OIDC_ISSUER_URL}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: OIDC_AUDIENCE,
        username: 'reviewer@example.com',
        password: 'reviewer-dev-password',
        scope: 'openid',
      }),
    },
  );
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error(`token request failed: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

function contextFor(
  authorizationHeader?: string,
  tenantIdHeader?: string,
): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; authContext?: AuthContext };
} {
  const request: {
    headers: Record<string, string>;
    authContext?: AuthContext;
  } = { headers: {} };
  if (authorizationHeader !== undefined) {
    request.headers['authorization'] = authorizationHeader;
  }
  if (tenantIdHeader !== undefined) {
    request.headers['x-tenant-id'] = tenantIdHeader;
  }
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describeOrSkip('OidcGuard (Section 16.1, M5-024)', () => {
  let dataSource: DataSource;
  let guard: OidcGuard;
  let subject: string;
  let userId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [User, TenantMembership],
    });
    await dataSource.initialize();

    const oidcService = new OidcService(
      new ConfigService({ OIDC_ISSUER_URL, OIDC_AUDIENCE }),
    );
    guard = new OidcGuard(
      oidcService,
      dataSource.getRepository(User),
      dataSource.getRepository(TenantMembership),
    );

    const token = await fetchRealToken();
    // decodeJwt (no signature verification) is only ever used here, in
    // test setup, to learn which real `sub` this real token carries so a
    // matching User row can be provisioned — never on the guard's own
    // real verification path (that always goes through OidcService.verify,
    // which does verify the signature).
    const claims = decodeJwt(token);
    subject = claims.sub as string;

    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        subject,
        email: 'reviewer@example.com',
      }),
    );
    userId = user.id;
    userIds.push(user.id);
  }, 15_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (userIds.length > 0) {
        await dataSource
          .getRepository(TenantMembership)
          .createQueryBuilder()
          .delete()
          .where('"userId" IN (:...ids)', { ids: userIds })
          .execute();
        await dataSource.getRepository(User).delete(userIds);
      }
      await dataSource.destroy();
    }
  });

  it('accepts a real token for a provisioned user with a real tenant membership, attaching the resolved AuthContext', async () => {
    const tenantId = randomUUID();
    await dataSource.getRepository(TenantMembership).save(
      dataSource.getRepository(TenantMembership).create({
        tenantId,
        userId,
        role: ApiClientRole.REVIEWER,
      }),
    );

    const token = await fetchRealToken();
    const { context, request } = contextFor(`Bearer ${token}`, tenantId);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext).toEqual({
      tenantId,
      actorId: userId,
      role: ApiClientRole.REVIEWER,
      correlationId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    });
  }, 15_000);

  it('rejects a real, otherwise-valid token when no X-Tenant-Id header is present', async () => {
    const token = await fetchRealToken();
    const { context } = contextFor(`Bearer ${token}`, undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  }, 15_000);

  it('rejects a real token for a real user with no membership in the requested tenant', async () => {
    const token = await fetchRealToken();
    const { context } = contextFor(`Bearer ${token}`, randomUUID());
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  }, 15_000);

  it('rejects a real, valid token whose subject has no provisioned User row at all', async () => {
    // A syntactically/cryptographically valid token from Keycloak's own
    // separate "master" realm's admin-cli client would still fail this
    // guard's own User lookup — but obtaining one requires the admin
    // credential this test intentionally doesn't reach for. Simpler and
    // just as real: a well-formed but nonexistent subject fails the same
    // way any unrecognized bearer credential does — verified via a
    // temporarily-deleted user of our own instead.
    const token = await fetchRealToken();
    await dataSource.getRepository(User).delete({ subject });
    try {
      const { context } = contextFor(`Bearer ${token}`, randomUUID());
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    } finally {
      const restored = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          subject,
          email: 'reviewer@example.com',
        }),
      );
      // A fresh row, not the original — track it separately for cleanup
      // rather than reusing the stale `userId` captured in beforeAll.
      userIds.push(restored.id);
    }
  }, 15_000);

  it('rejects a malformed token', async () => {
    const { context } = contextFor('Bearer not-a-real-jwt', randomUUID());
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = contextFor(undefined, randomUUID());
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
