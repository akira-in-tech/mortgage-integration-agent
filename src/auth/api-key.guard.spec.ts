import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../database/entities/api-client.entity';
import {
  ApiClientRole,
  ApiClientStatus,
} from '../database/enums/api-client.enum';
import { ApiClientService } from './api-client.service';
import { ApiKeyGuard } from './api-key.guard';
import { AuthContext } from './auth-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured. This guard is the API-layer half of Section 20 M5's own
// exit evidence ("cross-tenant tests fail closed at API... layers"), so
// it's tested against a real persisted ApiClient row, not a mock.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

function contextFor(authorizationHeader?: string): {
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
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describeOrSkip('ApiKeyGuard', () => {
  let dataSource: DataSource;
  let apiClientService: ApiClientService;
  let guard: ApiKeyGuard;
  const clientIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ApiClient],
    });
    await dataSource.initialize();
    apiClientService = new ApiClientService(
      dataSource.getRepository(ApiClient),
    );
    guard = new ApiKeyGuard(dataSource.getRepository(ApiClient));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (clientIds.length > 0) {
        await dataSource.getRepository(ApiClient).delete(clientIds);
      }
      await dataSource.destroy();
    }
  });

  it('accepts a valid bearer token and attaches the resolved tenant/client/role (default PARTNER) to the request', async () => {
    const tenantId = randomUUID();
    const { client, token } = await apiClientService.create({
      tenantId,
      name: 'guard-spec-client',
    });
    clientIds.push(client.id);

    const { context, request } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext).toEqual({
      tenantId,
      apiClientId: client.id,
      role: 'PARTNER',
    });
  });

  it('attaches a REVIEWER role (M5-017) when the client was minted with one', async () => {
    const tenantId = randomUUID();
    const { client, token } = await apiClientService.create({
      tenantId,
      name: 'guard-spec-reviewer-client',
      role: ApiClientRole.REVIEWER,
    });
    clientIds.push(client.id);

    const { context, request } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext?.role).toBe('REVIEWER');
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = contextFor(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { context } = contextFor('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a malformed token with no clientId.secret separator', async () => {
    const { context } = contextFor('Bearer not-a-valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a clientId that is not a well-formed UUID, without ever querying the database', async () => {
    const { context } = contextFor(`Bearer garbage.token`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown clientId', async () => {
    const { context } = contextFor(`Bearer ${randomUUID()}.${'a'.repeat(64)}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects the correct clientId with the wrong secret', async () => {
    const { client } = await apiClientService.create({
      tenantId: randomUUID(),
      name: 'guard-spec-wrong-secret',
    });
    clientIds.push(client.id);

    const { context } = contextFor(`Bearer ${client.id}.${'0'.repeat(64)}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed for a revoked client even with the correct secret', async () => {
    const { client, token } = await apiClientService.create({
      tenantId: randomUUID(),
      name: 'guard-spec-revoked',
    });
    clientIds.push(client.id);
    await dataSource
      .getRepository(ApiClient)
      .update({ id: client.id }, { status: ApiClientStatus.REVOKED });

    const { context } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
