import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { decodeJwt } from 'jose';
import { ApiClient } from '../database/entities/api-client.entity';
import { User } from '../database/entities/user.entity';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { ApiClientService } from './api-client.service';
import { ApiKeyGuard } from './api-key.guard';
import { OidcService } from './oidc.service';
import { OidcGuard } from './oidc.guard';
import { TenantAuthGuard } from './tenant-auth.guard';
import { AuthContext } from './auth-context';

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

/**
 * M5-024's real proof that `TenantAuthGuard` genuinely composes both
 * credential models with OR, not AND: a machine `api_clients` bearer
 * token and a real OIDC token from a real Keycloak both independently
 * authenticate through the exact same guard instance.
 */
describeOrSkip('TenantAuthGuard (Section 16.1, M5-024)', () => {
  let dataSource: DataSource;
  let guard: TenantAuthGuard;
  let apiClientService: ApiClientService;
  const apiClientIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ApiClient, User, TenantMembership],
    });
    await dataSource.initialize();

    apiClientService = new ApiClientService(
      dataSource.getRepository(ApiClient),
    );
    const apiKeyGuard = new ApiKeyGuard(dataSource.getRepository(ApiClient));
    const oidcService = new OidcService(
      new ConfigService({ OIDC_ISSUER_URL, OIDC_AUDIENCE }),
    );
    const oidcGuard = new OidcGuard(
      oidcService,
      dataSource.getRepository(User),
      dataSource.getRepository(TenantMembership),
    );
    guard = new TenantAuthGuard(apiKeyGuard, oidcGuard);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (apiClientIds.length > 0) {
        await dataSource.getRepository(ApiClient).delete(apiClientIds);
      }
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

  it('authenticates a real machine api_client bearer token', async () => {
    const tenantId = randomUUID();
    const { client, token } = await apiClientService.create({
      tenantId,
      name: 'tenant-auth-guard-spec-client',
    });
    apiClientIds.push(client.id);

    const { context, request } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext).toMatchObject({
      tenantId,
      actorId: client.id,
      role: 'PARTNER',
    });
  });

  it('authenticates a real OIDC token for a provisioned user with a real tenant membership', async () => {
    const token = await fetchRealToken();
    const subject = decodeJwt(token).sub as string;
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        subject,
        email: 'reviewer@example.com',
      }),
    );
    userIds.push(user.id);

    const tenantId = randomUUID();
    await dataSource.getRepository(TenantMembership).save(
      dataSource.getRepository(TenantMembership).create({
        tenantId,
        userId: user.id,
        role: ApiClientRole.REVIEWER,
      }),
    );

    const { context, request } = contextFor(`Bearer ${token}`, tenantId);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext).toMatchObject({
      tenantId,
      actorId: user.id,
      role: 'REVIEWER',
    });
  }, 15_000);

  it('rejects a bearer token that matches neither credential shape', async () => {
    const { context } = contextFor('Bearer garbage-token', randomUUID());
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falls through to OidcGuard for a real OIDC token and surfaces its rejection when the requested tenant has no membership', async () => {
    // The prior test already provisioned a real User row for this same
    // fixed test subject (Keycloak returns the same `sub` for the same
    // seeded user every time) — this confirms TenantAuthGuard's own OR
    // fallback genuinely reaches OidcGuard's real database check for a
    // never-granted tenantId, rather than short-circuiting on ApiKeyGuard
    // alone. OidcGuard's own dedicated spec covers the unknown-subject
    // and missing-header cases directly.
    const token = await fetchRealToken();
    const { context } = contextFor(`Bearer ${token}`, randomUUID());
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  }, 15_000);
});
