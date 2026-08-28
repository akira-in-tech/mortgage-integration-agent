import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { PlatformAdminStatus } from '../database/enums/platform-admin.enum';
import { ApiClient } from '../database/entities/api-client.entity';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminContext } from './platform-admin-context';
import { ApiClientService } from './api-client.service';

// Same "skip instead of failing" convention as api-key.guard.spec.ts —
// requires a reachable Postgres.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

function contextFor(authorizationHeader?: string): {
  context: ExecutionContext;
  request: {
    headers: Record<string, string>;
    platformAdminContext?: PlatformAdminContext;
  };
} {
  const request: {
    headers: Record<string, string>;
    platformAdminContext?: PlatformAdminContext;
  } = { headers: {} };
  if (authorizationHeader !== undefined) {
    request.headers['authorization'] = authorizationHeader;
  }
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describeOrSkip('PlatformAdminGuard', () => {
  let dataSource: DataSource;
  let platformAdminService: PlatformAdminService;
  let guard: PlatformAdminGuard;
  const adminIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [PlatformAdmin],
    });
    await dataSource.initialize();
    platformAdminService = new PlatformAdminService(
      dataSource.getRepository(PlatformAdmin),
    );
    guard = new PlatformAdminGuard(dataSource.getRepository(PlatformAdmin));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (adminIds.length > 0) {
        await dataSource.getRepository(PlatformAdmin).delete(adminIds);
      }
      await dataSource.destroy();
    }
  });

  it('accepts a valid bearer token and attaches the resolved admin identity to the request — no tenantId anywhere', async () => {
    const { admin, token } =
      await platformAdminService.create('guard-spec-admin');
    adminIds.push(admin.id);

    const { context, request } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.platformAdminContext).toEqual({
      adminId: admin.id,
      adminName: 'guard-spec-admin',
      correlationId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    });
    expect(request.platformAdminContext).not.toHaveProperty('tenantId');
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = contextFor(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown adminId', async () => {
    const unknownToken = `${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}.${'a'.repeat(64)}`;
    const { context } = contextFor(`Bearer ${unknownToken}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects the correct adminId with the wrong secret', async () => {
    const { admin } = await platformAdminService.create(
      'guard-spec-wrong-secret',
    );
    adminIds.push(admin.id);

    const { context } = contextFor(`Bearer ${admin.id}.${'0'.repeat(64)}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed for a revoked admin even with the correct secret', async () => {
    const { admin, token } =
      await platformAdminService.create('guard-spec-revoked');
    adminIds.push(admin.id);
    await dataSource
      .getRepository(PlatformAdmin)
      .update({ id: admin.id }, { status: PlatformAdminStatus.REVOKED });

    const { context } = contextFor(`Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // The actual security property this whole credential type exists for:
  // a tenant's own bearer token — even a REVIEWER one — must not be able
  // to reach the provider promotion chain, because that chain isn't
  // scoped to any one tenant. It fails here for the mundane reason that
  // an ApiClient row simply doesn't exist in platform_admins, which is
  // exactly the point — there is no shared table or shared secret space
  // for a tenant credential to accidentally satisfy.
  it('rejects a real tenant ApiClient bearer token — a tenant credential is not a platform-admin credential', async () => {
    const apiClientDataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ApiClient],
    });
    await apiClientDataSource.initialize();
    try {
      const apiClientService = new ApiClientService(
        apiClientDataSource.getRepository(ApiClient),
      );
      const { client, token } = await apiClientService.create({
        tenantId: randomUUID(),
        name: 'guard-spec-tenant-client',
      });

      const { context } = contextFor(`Bearer ${token}`);
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      await apiClientDataSource.getRepository(ApiClient).delete(client.id);
    } finally {
      await apiClientDataSource.destroy();
    }
  });
});
