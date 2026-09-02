import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { GuestSandboxSession } from '../database/entities/guest-sandbox-session.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import {
  GUEST_SANDBOX_COOKIE,
  GUEST_SANDBOX_CSRF_COOKIE,
  GuestSandboxService,
} from './guest-sandbox.service';
import * as purgeTenantDataModule from '../database/purge-tenant-data';

// This file is a pure-logic unit spec (no real Postgres) — the real,
// Postgres-backed proof that purgeTenantData() actually deletes every
// real row lives in purge-tenant-data.spec.ts. Spying on it here (rather
// than a bare jest.mock(), which this module's own many entity-class
// imports made unreliable to auto-mock) keeps this file's own job
// narrow: proving GuestSandboxService correctly identifies which
// sessions are expired and calls the shared purge function with the
// right tenant id for each one, not re-verifying the purge function's
// own internals a second time.
let purgeTenantDataMock: jest.SpiedFunction<
  typeof purgeTenantDataModule.purgeTenantData
>;

function requestWithCookies(
  cookies: Record<string, string>,
  csrfHeader?: string,
): Request {
  return {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
      ...(csrfHeader ? { 'x-csrf-token': csrfHeader } : {}),
    },
  } as Request;
}

describe('GuestSandboxService', () => {
  let sessions: GuestSandboxSession[];
  let seededConsent: Partial<ConsentRecord> | null;
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
  };
  let response: Pick<Response, 'cookie' | 'clearCookie'>;
  let service: GuestSandboxService;

  beforeEach(() => {
    sessions = [];
    seededConsent = null;
    sessionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const session = {
          ...value,
          id: value.id ?? '10000000-0000-4000-8000-000000000001',
        } as GuestSandboxSession;
        const existing = sessions.findIndex((item) => item.id === session.id);
        if (existing >= 0) sessions[existing] = session;
        else sessions.push(session);
        return session;
      }),
      delete: jest.fn(async (criteria) => {
        if ('id' in criteria) {
          sessions = sessions.filter((session) => session.id !== criteria.id);
        }
        return { affected: 1 };
      }),
      findOneBy: jest.fn(async ({ sessionTokenHash }) =>
        sessions.find(
          (session) => session.sessionTokenHash === sessionTokenHash,
        ),
      ),
      // purgeExpiredSessions() always calls find() with an
      // "expiresAt < now" operator — this mock doesn't inspect the
      // FindOperator shape, it just applies the same real comparison
      // directly against the in-memory fixture.
      find: jest.fn(async () =>
        sessions.filter((session) => session.expiresAt.getTime() < Date.now()),
      ),
    };
    let tenantSequence = 0;
    let caseSequence = 0;
    const repositoryFor = (entity: unknown) => {
      if (entity === GuestSandboxSession) return sessionRepository;
      if (entity === Tenant) {
        return {
          create: jest.fn((value) => value),
          save: jest.fn(async (value) => ({
            ...value,
            id: `20000000-0000-4000-8000-${String(++tenantSequence).padStart(12, '0')}`,
          })),
        };
      }
      if (entity === LoanCase) {
        return {
          create: jest.fn((value) => value),
          save: jest.fn(async (value) => ({
            ...value,
            id: `30000000-0000-4000-8000-${String(++caseSequence).padStart(12, '0')}`,
          })),
        };
      }
      if (entity === ConsentRecord) {
        return {
          create: jest.fn((value) => value),
          save: jest.fn(async (value) => {
            seededConsent = value;
            return value;
          }),
        };
      }
      throw new Error('unexpected repository');
    };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn(repositoryFor),
    };
    const dataSource = {
      transaction: jest.fn((work) => work(manager)),
    };
    purgeTenantDataMock = jest
      .spyOn(purgeTenantDataModule, 'purgeTenantData')
      .mockResolvedValue(undefined);
    response = { cookie: jest.fn(), clearCookie: jest.fn() };
    service = new GuestSandboxService(
      new ConfigService({ NODE_ENV: 'test', GUEST_SANDBOX_TTL_SECONDS: 3600 }),
      dataSource as never,
      sessionRepository as never,
    );
  });

  afterEach(() => {
    purgeTenantDataMock.mockRestore();
  });

  it('creates an isolated synthetic tenant and authenticates it through an opaque cookie', async () => {
    const created = await service.create(response as Response);
    const cookieCalls = (response.cookie as jest.Mock).mock.calls;
    const sessionCookie = cookieCalls.find(
      ([name]) => name === GUEST_SANDBOX_COOKIE,
    );
    const csrfCookie = cookieCalls.find(
      ([name]) => name === GUEST_SANDBOX_CSRF_COOKIE,
    );
    const cookies = {
      [GUEST_SANDBOX_COOKIE]: sessionCookie[1] as string,
      [GUEST_SANDBOX_CSRF_COOKIE]: csrfCookie[1] as string,
    };

    expect(created).toMatchObject({
      authenticated: true,
      tenantId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      actorId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      caseId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(JSON.stringify(sessions)).not.toContain(
      cookies[GUEST_SANDBOX_COOKIE],
    );
    expect(seededConsent).toMatchObject({
      permittedPurposes: ['UNDERWRITING_EVIDENCE'],
      permittedDataClasses: expect.arrayContaining(['INCOME', 'CREDIT']),
    });
    await expect(
      service.authenticate(
        requestWithCookies(cookies),
        response as Response,
        false,
      ),
    ).resolves.toMatchObject({
      tenantId: created.tenantId,
      actorId: created.actorId,
      role: 'REVIEWER',
    });
  });

  it('requires a matching double-submit CSRF value before a guest mutation or logout', async () => {
    await service.create(response as Response);
    const cookieCalls = (response.cookie as jest.Mock).mock.calls;
    const cookies = {
      [GUEST_SANDBOX_COOKIE]: cookieCalls.find(
        ([name]) => name === GUEST_SANDBOX_COOKIE,
      )[1] as string,
      [GUEST_SANDBOX_CSRF_COOKIE]: cookieCalls.find(
        ([name]) => name === GUEST_SANDBOX_CSRF_COOKIE,
      )[1] as string,
    };

    await expect(
      service.authenticate(
        requestWithCookies(cookies),
        response as Response,
        true,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.logout(requestWithCookies(cookies), response as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.logout(
        requestWithCookies(cookies, cookies[GUEST_SANDBOX_CSRF_COOKIE]),
        response as Response,
      ),
    ).resolves.toBeUndefined();
    expect(sessions).toHaveLength(0);
  });

  // M7-055: this used to only delete the expired session row itself,
  // leaving the tenant/case/consent rows it created behind forever —
  // every visit to this public, unauthenticated endpoint permanently
  // grew real staging RDS. Proves purgeExpiredSessions() (called both
  // opportunistically from create() and on a real interval from
  // worker.ts) purges the real tenant data for every expired session,
  // not just its own row, and leaves an unexpired session alone.
  it('purgeExpiredSessions() purges the real tenant data for every expired session, and leaves an unexpired one untouched', async () => {
    const expiredTenantId = '40000000-0000-4000-8000-000000000001';
    const stillValidTenantId = '40000000-0000-4000-8000-000000000002';
    sessions.push(
      {
        id: 'expired-session',
        tenantId: expiredTenantId,
        expiresAt: new Date(Date.now() - 60_000),
      } as GuestSandboxSession,
      {
        id: 'valid-session',
        tenantId: stillValidTenantId,
        expiresAt: new Date(Date.now() + 60_000),
      } as GuestSandboxSession,
    );

    const purged = await service.purgeExpiredSessions();

    expect(purged).toBe(1);
    expect(purgeTenantDataMock).toHaveBeenCalledTimes(1);
    expect(purgeTenantDataMock).toHaveBeenCalledWith(
      expect.anything(),
      expiredTenantId,
    );
    expect(sessions.map((s) => s.id)).toEqual(['valid-session']);
  });

  it("create()'s own opportunistic sweep purges an expired session's tenant data too, not just at the worker's interval", async () => {
    const expiredTenantId = '40000000-0000-4000-8000-000000000003';
    sessions.push({
      id: 'expired-session-2',
      tenantId: expiredTenantId,
      expiresAt: new Date(Date.now() - 60_000),
    } as GuestSandboxSession);

    await service.create(response as Response);

    expect(purgeTenantDataMock).toHaveBeenCalledWith(
      expect.anything(),
      expiredTenantId,
    );
    expect(sessions.find((s) => s.id === 'expired-session-2')).toBeUndefined();
  });
});
