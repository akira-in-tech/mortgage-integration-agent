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
    refresh: jest.Mock;
    buildLogoutUrl: jest.Mock;
  };
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOneBy: jest.Mock;
  };
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
    const userRepository = {
      findOneBy: jest.fn(async ({ subject, id }) =>
        subject === USER.subject || id === USER.id ? USER : null,
      ),
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
});
