import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { OidcSession } from '../database/entities/oidc-session.entity';
import { User } from '../database/entities/user.entity';
import {
  OIDC_CSRF_COOKIE,
  OIDC_SESSION_COOKIE,
  OidcSessionService,
} from './oidc-session.service';

const USER = {
  id: '10000000-0000-4000-8000-000000000001',
  subject: 'issuer-subject',
  email: 'reviewer@example.com',
} as User;

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

describe('OidcSessionService', () => {
  let stored: OidcSession | null;
  let oidcService: {
    buildAuthorizationUrl: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
    verify: jest.Mock;
    verifyIdToken: jest.Mock;
    refresh: jest.Mock;
    buildLogoutUrl: jest.Mock;
  };
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOneBy: jest.Mock;
  };
  let selfServiceProvisioning: { resolveUser: jest.Mock };
  let userRepository: { findOneBy: jest.Mock };
  let response: Pick<Response, 'cookie' | 'clearCookie'>;
  let service: OidcSessionService;

  beforeEach(() => {
    stored = null;
    oidcService = {
      buildAuthorizationUrl: jest.fn().mockResolvedValue('https://idp/login'),
      exchangeAuthorizationCode: jest.fn().mockResolvedValue({
        access_token: 'provider-access-token',
        refresh_token: 'provider-refresh-token',
        id_token: 'provider-id-token',
        expires_in: 300,
      }),
      verify: jest.fn().mockResolvedValue({ sub: USER.subject }),
      verifyIdToken: jest
        .fn()
        .mockResolvedValue({ sub: USER.subject, email: USER.email }),
      refresh: jest.fn(),
      buildLogoutUrl: jest.fn().mockResolvedValue('https://idp/logout'),
    };
    sessionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        stored = {
          id: value.id ?? '20000000-0000-4000-8000-000000000002',
          ...value,
        } as OidcSession;
        return stored;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneBy: jest.fn(async () => stored),
    };
    userRepository = {
      findOneBy: jest.fn(async ({ subject, id }) =>
        subject === USER.subject || id === USER.id ? USER : null,
      ),
    };
    selfServiceProvisioning = {
      resolveUser: jest.fn().mockResolvedValue(USER),
    };
    const config = new ConfigService({
      NODE_ENV: 'test',
      OIDC_CALLBACK_URL: 'http://localhost:5173/v1/auth/session/callback',
      CONSOLE_ORIGIN: 'http://localhost:5173',
      OIDC_SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
      OIDC_SESSION_MAX_AGE_SECONDS: 28_800,
    });
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    service = new OidcSessionService(
      oidcService as never,
      config,
      sessionRepository as never,
      userRepository as never,
      selfServiceProvisioning as never,
    );
  });

  it('keeps PKCE state in short-lived HttpOnly cookies', async () => {
    await expect(
      service.beginLogin(response as Response, '//evil.test'),
    ).resolves.toBe('https://idp/login');

    expect(response.cookie).toHaveBeenCalledTimes(3);
    for (const [, , options] of (response.cookie as jest.Mock).mock.calls) {
      expect(options).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/v1/auth/session',
      });
    }
    expect(oidcService.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: 'http://localhost:5173/v1/auth/session/callback',
        state: expect.any(String),
        codeChallenge: expect.any(String),
      }),
    );
  });

  it('rejects a callback whose state does not match before exchanging code', async () => {
    await expect(
      service.completeLogin(
        requestWithCookies({
          meridian_login_state: 'expected',
          meridian_login_verifier: 'verifier',
        }),
        response as Response,
        'authorization-code',
        'forged',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(oidcService.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('stores only hashes and authenticated ciphertext before issuing cookies', async () => {
    const returnUrl = await service.completeLogin(
      requestWithCookies({
        meridian_login_state: 'matching-state',
        meridian_login_verifier: 'pkce-verifier',
        meridian_login_return: '/cases?queue=review',
      }),
      response as Response,
      'authorization-code',
      'matching-state',
    );

    expect(returnUrl).toBe('http://localhost:5173/cases?queue=review');
    expect(stored?.sessionTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.csrfTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.encryptedTokenBundle).toMatch(/^v2\.legacy\./);
    expect(stored?.encryptedTokenBundle).not.toContain('provider-access-token');
    expect(JSON.stringify(stored)).not.toContain('provider-refresh-token');
    expect(selfServiceProvisioning.resolveUser).toHaveBeenCalledWith(
      { sub: USER.subject },
      { sub: USER.subject, email: USER.email },
    );

    const sessionCookie = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_SESSION_COOKIE,
    );
    const csrfCookie = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_CSRF_COOKIE,
    );
    expect(sessionCookie[2]).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    expect(csrfCookie[2]).toMatchObject({ httpOnly: false, sameSite: 'lax' });
  });

  it('authenticates an opaque session and enforces double-submit CSRF', async () => {
    await service.completeLogin(
      requestWithCookies({
        meridian_login_state: 'state',
        meridian_login_verifier: 'verifier',
      }),
      response as Response,
      'code',
      'state',
    );
    const sessionCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_SESSION_COOKIE,
    );
    const csrfCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_CSRF_COOKIE,
    );
    const cookies = {
      [OIDC_SESSION_COOKIE]: sessionCall[1] as string,
      [OIDC_CSRF_COOKIE]: csrfCall[1] as string,
    };

    await expect(
      service.authenticateCookie(
        requestWithCookies(cookies, csrfCall[1] as string),
        response as Response,
        true,
      ),
    ).resolves.toMatchObject({ user: USER, csrfToken: csrfCall[1] });
    await expect(
      service.authenticateCookie(
        requestWithCookies(cookies),
        response as Response,
        true,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes an expiring provider token and persists the rotated ciphertext', async () => {
    await service.completeLogin(
      requestWithCookies({
        meridian_login_state: 'state',
        meridian_login_verifier: 'verifier',
      }),
      response as Response,
      'code',
      'state',
    );
    const initialCiphertext = stored?.encryptedTokenBundle;
    const sessionCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_SESSION_COOKIE,
    );
    const csrfCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_CSRF_COOKIE,
    );
    if (!stored) throw new Error('test session was not stored');
    stored.accessExpiresAt = new Date(Date.now() - 1);
    oidcService.refresh.mockResolvedValue({
      access_token: 'rotated-access-token',
      refresh_token: 'rotated-refresh-token',
      expires_in: 600,
    });

    await service.authenticateCookie(
      requestWithCookies({
        [OIDC_SESSION_COOKIE]: sessionCall[1] as string,
        [OIDC_CSRF_COOKIE]: csrfCall[1] as string,
      }),
      response as Response,
      false,
    );

    expect(oidcService.refresh).toHaveBeenCalledWith('provider-refresh-token');
    expect(oidcService.verify).toHaveBeenLastCalledWith('rotated-access-token');
    expect(stored.encryptedTokenBundle).not.toBe(initialCiphertext);
    expect(stored.encryptedTokenBundle).not.toContain('rotated-access-token');
  });

  it('deletes the durable session before returning provider logout', async () => {
    await service.completeLogin(
      requestWithCookies({
        meridian_login_state: 'state',
        meridian_login_verifier: 'verifier',
      }),
      response as Response,
      'code',
      'state',
    );
    const sessionCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_SESSION_COOKIE,
    );
    const csrfCall = (response.cookie as jest.Mock).mock.calls.find(
      ([name]) => name === OIDC_CSRF_COOKIE,
    );

    await expect(
      service.logout(
        requestWithCookies(
          {
            [OIDC_SESSION_COOKIE]: sessionCall[1] as string,
            [OIDC_CSRF_COOKIE]: csrfCall[1] as string,
          },
          csrfCall[1] as string,
        ),
        response as Response,
      ),
    ).resolves.toBe('https://idp/logout');
    expect(sessionRepository.delete).toHaveBeenLastCalledWith({
      id: stored?.id,
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      OIDC_SESSION_COOKIE,
      expect.objectContaining({ path: '/' }),
    );
  });

  // M7-055: an M7-047 audit found the key-ring rotation mechanism was the
  // one encryption feature in this codebase with no dedicated rotation
  // test and no operator documentation, unlike its sibling
  // SensitiveJsonCipher (provider/evidence encryption), which has both.
  // encrypt()/decrypt() are private, so this proves the real behavior
  // through the same public completeLogin()/authenticateCookie() surface
  // every other test in this file already uses — two real service
  // instances sharing the same in-memory session store, one configured
  // before a rotation and one after, exactly the way a real deployment
  // would roll a new OIDC_SESSION_ENCRYPTION_KEYS value out.
  describe('OIDC_SESSION_ENCRYPTION_KEYS rotation', () => {
    const oldKey = 'a'.repeat(64);
    const newKey = 'b'.repeat(64);

    function buildService(keyRing: string): OidcSessionService {
      const config = new ConfigService({
        NODE_ENV: 'test',
        OIDC_CALLBACK_URL: 'http://localhost:5173/v1/auth/session/callback',
        CONSOLE_ORIGIN: 'http://localhost:5173',
        OIDC_SESSION_ENCRYPTION_KEYS: keyRing,
        OIDC_SESSION_MAX_AGE_SECONDS: 28_800,
      });
      return new OidcSessionService(
        oidcService as never,
        config,
        sessionRepository as never,
        userRepository as never,
        selfServiceProvisioning as never,
      );
    }

    it('decrypts a session created before rotation using the retired key still in the ring, then re-encrypts it under the new current key on refresh', async () => {
      const preRotationService = buildService(`legacy:${oldKey}`);
      await preRotationService.completeLogin(
        requestWithCookies({
          meridian_login_state: 'state',
          meridian_login_verifier: 'verifier',
        }),
        response as Response,
        'code',
        'state',
      );
      expect(stored?.encryptedTokenBundle).toMatch(/^v2\.legacy\./);
      const sessionCall = (response.cookie as jest.Mock).mock.calls.find(
        ([name]) => name === OIDC_SESSION_COOKIE,
      );
      const csrfCall = (response.cookie as jest.Mock).mock.calls.find(
        ([name]) => name === OIDC_CSRF_COOKIE,
      );
      const cookies = {
        [OIDC_SESSION_COOKIE]: sessionCall[1] as string,
        [OIDC_CSRF_COOKIE]: csrfCall[1] as string,
      };

      // Rotation: a new current key, the old one retained under its same
      // id so sessions issued before rotation keep working.
      const postRotationService = buildService(
        `current:${newKey},legacy:${oldKey}`,
      );

      await expect(
        postRotationService.authenticateCookie(
          requestWithCookies(cookies, cookies[OIDC_CSRF_COOKIE]),
          response as Response,
          true,
        ),
      ).resolves.toMatchObject({ user: USER });

      // Force a refresh so the stored ciphertext gets rewritten — it must
      // now be encrypted under the new current key, not the retired one.
      if (!stored) throw new Error('test session was not stored');
      stored.accessExpiresAt = new Date(Date.now() - 1);
      oidcService.refresh.mockResolvedValue({
        access_token: 'rotated-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 600,
      });
      await postRotationService.authenticateCookie(
        requestWithCookies(cookies, cookies[OIDC_CSRF_COOKIE]),
        response as Response,
        false,
      );
      expect(stored.encryptedTokenBundle).toMatch(/^v2\.current\./);

      // And a service that never learned about the new key can no longer
      // read the now-current-key-encrypted session — proves the ring is
      // really keyed by id, not "any previously-issued key still works."
      await expect(
        preRotationService.authenticateCookie(
          requestWithCookies(cookies, cookies[OIDC_CSRF_COOKIE]),
          response as Response,
          true,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a session encrypted under a key that has since been fully retired (dropped from the ring, not just rotated past)', async () => {
      const beforeDropService = buildService(`old:${oldKey}`);
      await beforeDropService.completeLogin(
        requestWithCookies({
          meridian_login_state: 'state',
          meridian_login_verifier: 'verifier',
        }),
        response as Response,
        'code',
        'state',
      );
      const sessionCall = (response.cookie as jest.Mock).mock.calls.find(
        ([name]) => name === OIDC_SESSION_COOKIE,
      );
      const csrfCall = (response.cookie as jest.Mock).mock.calls.find(
        ([name]) => name === OIDC_CSRF_COOKIE,
      );
      const cookies = {
        [OIDC_SESSION_COOKIE]: sessionCall[1] as string,
        [OIDC_CSRF_COOKIE]: csrfCall[1] as string,
      };

      // "old" is gone from the ring entirely, not retained — the real
      // operational mistake key-ring rotation is meant to let an operator
      // avoid making by mistake, proven here as a real rejection rather
      // than assumed.
      const afterDropService = buildService(`current:${newKey}`);
      await expect(
        afterDropService.authenticateCookie(
          requestWithCookies(cookies, cookies[OIDC_CSRF_COOKIE]),
          response as Response,
          true,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
