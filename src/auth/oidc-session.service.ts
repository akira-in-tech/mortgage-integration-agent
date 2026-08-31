import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { CookieOptions, Request, Response } from 'express';
import { LessThan, Repository } from 'typeorm';
import { OidcSession } from '../database/entities/oidc-session.entity';
import { User } from '../database/entities/user.entity';
import { NodeEnvironment } from '../config/env.validation';
import { OidcClaims, OidcService, OidcTokenResponse } from './oidc.service';
import { readCookie } from './http-cookie';

export const OIDC_SESSION_COOKIE = 'meridian_session';
export const OIDC_CSRF_COOKIE = 'meridian_csrf';
const LOGIN_STATE_COOKIE = 'meridian_login_state';
const LOGIN_VERIFIER_COOKIE = 'meridian_login_verifier';
const LOGIN_RETURN_COOKIE = 'meridian_login_return';
const LOGIN_COOKIE_PATH = '/v1/auth/session';
const LOGIN_TTL_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 30_000;
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const DEV_ENCRYPTION_KEY = createHash('sha256')
  .update('meridian-local-oidc-session-key')
  .digest();

interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}

export interface OidcSessionIdentity {
  claims: OidcClaims;
  user: User;
  csrfToken: string;
}

/**
 * Same-origin backend-for-frontend session boundary. Provider tokens are
 * AES-256-GCM ciphertext in PostgreSQL; the browser holds only an opaque,
 * HttpOnly handle plus a non-secret double-submit CSRF value. Any API replica
 * with the same database and encryption key can resume or refresh a session.
 */
@Injectable()
export class OidcSessionService {
  private readonly callbackUrl: string;
  private readonly consoleOrigin: string;
  private readonly secureCookies: boolean;
  private readonly sessionMaxAgeSeconds: number;
  private readonly currentEncryptionKeyId: string;
  private readonly encryptionKeys: Map<string, Buffer>;

  constructor(
    private readonly oidcService: OidcService,
    private readonly configService: ConfigService,
    @InjectRepository(OidcSession)
    private readonly sessionRepository: Repository<OidcSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const nodeEnv = configService.get<NodeEnvironment>(
      'NODE_ENV',
      NodeEnvironment.Development,
    );
    this.secureCookies =
      nodeEnv === NodeEnvironment.Production ||
      nodeEnv === NodeEnvironment.Staging;
    this.callbackUrl =
      configService.get<string>('OIDC_CALLBACK_URL') ??
      'http://localhost:5173/v1/auth/session/callback';
    this.consoleOrigin =
      configService.get<string>('CONSOLE_ORIGIN') ?? 'http://localhost:5173';
    this.sessionMaxAgeSeconds = configService.get<number>(
      'OIDC_SESSION_MAX_AGE_SECONDS',
      28_800,
    );
    const keyRing = configService.get<string>('OIDC_SESSION_ENCRYPTION_KEYS');
    const legacyKey = configService.get<string>('OIDC_SESSION_ENCRYPTION_KEY');
    const entries = keyRing
      ? keyRing.split(',').map((entry) => {
          const separator = entry.indexOf(':');
          return [
            entry.slice(0, separator),
            entry.slice(separator + 1),
          ] as const;
        })
      : [['legacy', legacyKey ?? DEV_ENCRYPTION_KEY.toString('hex')] as const];
    if (
      entries.some(
        ([id, key]) =>
          !/^[A-Za-z0-9._-]{1,64}$/.test(id) || !/^[0-9a-fA-F]{64}$/.test(key),
      )
    ) {
      throw new Error('invalid OIDC session encryption key ring');
    }
    this.currentEncryptionKeyId = entries[0][0];
    this.encryptionKeys = new Map(
      entries.map(([id, key]) => [id, Buffer.from(key, 'hex')]),
    );
  }

  async beginLogin(response: Response, returnTo = '/'): Promise<string> {
    const safeReturnTo = this.validateReturnPath(returnTo);
    const state = this.randomToken();
    const verifier = this.randomToken();
    const codeChallenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');
    const options = this.loginCookieOptions();
    response.cookie(LOGIN_STATE_COOKIE, state, options);
    response.cookie(LOGIN_VERIFIER_COOKIE, verifier, options);
    response.cookie(LOGIN_RETURN_COOKIE, safeReturnTo, options);
    return this.oidcService.buildAuthorizationUrl({
      redirectUri: this.callbackUrl,
      state,
      codeChallenge,
    });
  }

  async completeLogin(
    request: Request,
    response: Response,
    code: string,
    state: string,
  ): Promise<string> {
    const expectedState = readCookie(request, LOGIN_STATE_COOKIE);
    const verifier = readCookie(request, LOGIN_VERIFIER_COOKIE);
    const returnTo = this.validateReturnPath(
      readCookie(request, LOGIN_RETURN_COOKIE) ?? '/',
    );
    this.clearLoginCookies(response);
    if (!expectedState || !verifier || !this.safeEqual(state, expectedState)) {
      throw new UnauthorizedException('OIDC login state is invalid');
    }

    const tokens = await this.oidcService.exchangeAuthorizationCode({
      code,
      redirectUri: this.callbackUrl,
      codeVerifier: verifier,
    });
    const claims = await this.oidcService.verify(tokens.access_token);
    const user = await this.userRepository.findOneBy({ subject: claims.sub });
    if (!user) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    const now = new Date();
    const sessionToken = this.randomToken();
    const csrfToken = this.randomToken();
    const sessionTokenHash = this.hash(sessionToken);
    const accessExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
    // Providers are not required to return refresh_expires_in. A refresh
    // token still permits a durable BFF session, but never beyond the local
    // absolute session cap configured by the operator.
    const providerLifetime = tokens.refresh_token
      ? (tokens.refresh_expires_in ?? this.sessionMaxAgeSeconds)
      : tokens.expires_in;
    const expiresAt = new Date(
      now.getTime() +
        Math.min(providerLifetime, this.sessionMaxAgeSeconds) * 1000,
    );
    const bundle: TokenBundle = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
    };

    await this.sessionRepository.delete({ expiresAt: LessThan(now) });
    await this.sessionRepository.save(
      this.sessionRepository.create({
        sessionTokenHash,
        csrfTokenHash: this.hash(csrfToken),
        userId: user.id,
        encryptedTokenBundle: this.encrypt(bundle, sessionTokenHash),
        accessExpiresAt,
        expiresAt,
        lastUsedAt: now,
      }),
    );
    this.setSessionCookies(response, sessionToken, csrfToken, expiresAt);
    return new URL(returnTo, this.consoleOrigin).toString();
  }

  async authenticateCookie(
    request: Request,
    response: Response,
    requireCsrf: boolean,
  ): Promise<OidcSessionIdentity> {
    const rawSessionToken = readCookie(request, OIDC_SESSION_COOKIE);
    if (!rawSessionToken) throw this.unauthorized();
    const sessionTokenHash = this.hash(rawSessionToken);
    const session = await this.sessionRepository.findOneBy({
      sessionTokenHash,
    });
    if (!session) throw this.unauthorized();

    const now = new Date();
    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.sessionRepository.delete({ id: session.id });
      this.clearSessionCookies(response);
      throw this.unauthorized();
    }

    let sessionChanged = false;
    let csrfToken = readCookie(request, OIDC_CSRF_COOKIE);
    if (!csrfToken || this.hash(csrfToken) !== session.csrfTokenHash) {
      if (requireCsrf) throw this.unauthorized();
      csrfToken = this.randomToken();
      session.csrfTokenHash = this.hash(csrfToken);
      sessionChanged = true;
      response.cookie(
        OIDC_CSRF_COOKIE,
        csrfToken,
        this.csrfCookieOptions(session.expiresAt),
      );
    }
    if (requireCsrf) this.assertCsrf(request, csrfToken, session.csrfTokenHash);

    let bundle = this.decrypt(session.encryptedTokenBundle, sessionTokenHash);
    let claims: OidcClaims;
    if (session.accessExpiresAt.getTime() <= now.getTime() + REFRESH_SKEW_MS) {
      if (!bundle.refreshToken) throw this.unauthorized();
      const refreshed = await this.oidcService.refresh(bundle.refreshToken);
      claims = await this.oidcService.verify(refreshed.access_token);
      bundle = this.mergeRefreshedBundle(bundle, refreshed);
      session.encryptedTokenBundle = this.encrypt(bundle, sessionTokenHash);
      session.accessExpiresAt = new Date(
        now.getTime() + refreshed.expires_in * 1000,
      );
      if (refreshed.refresh_expires_in) {
        session.expiresAt = new Date(
          Math.min(
            session.expiresAt.getTime(),
            now.getTime() + refreshed.refresh_expires_in * 1000,
          ),
        );
      }
      sessionChanged = true;
    } else {
      claims = await this.oidcService.verify(bundle.accessToken);
    }

    const user = await this.userRepository.findOneBy({ id: session.userId });
    if (!user || user.subject !== claims.sub) throw this.unauthorized();
    if (
      now.getTime() - session.lastUsedAt.getTime() >=
        LAST_USED_WRITE_INTERVAL_MS ||
      session.accessExpiresAt.getTime() <= now.getTime() + REFRESH_SKEW_MS
    ) {
      session.lastUsedAt = now;
      sessionChanged = true;
    }
    if (sessionChanged) await this.sessionRepository.save(session);
    return { claims, user, csrfToken };
  }

  async logout(request: Request, response: Response): Promise<string | null> {
    const rawSessionToken = readCookie(request, OIDC_SESSION_COOKIE);
    if (!rawSessionToken) {
      this.clearSessionCookies(response);
      return null;
    }
    const sessionTokenHash = this.hash(rawSessionToken);
    const session = await this.sessionRepository.findOneBy({
      sessionTokenHash,
    });
    if (!session) {
      this.clearSessionCookies(response);
      return null;
    }
    const csrfToken = readCookie(request, OIDC_CSRF_COOKIE);
    if (!csrfToken) throw this.unauthorized();
    this.assertCsrf(request, csrfToken, session.csrfTokenHash);
    const bundle = this.decrypt(session.encryptedTokenBundle, sessionTokenHash);
    await this.sessionRepository.delete({ id: session.id });
    this.clearSessionCookies(response);
    return this.oidcService.buildLogoutUrl(
      bundle.idToken,
      `${this.consoleOrigin}/`,
    );
  }

  private mergeRefreshedBundle(
    previous: TokenBundle,
    refreshed: OidcTokenResponse,
  ): TokenBundle {
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? previous.refreshToken,
      idToken: refreshed.id_token ?? previous.idToken,
    };
  }

  private assertCsrf(
    request: Request,
    cookieToken: string,
    expectedHash: string,
  ): void {
    const header = request.headers['x-csrf-token'];
    if (
      typeof header !== 'string' ||
      !this.safeEqual(header, cookieToken) ||
      this.hash(header) !== expectedHash
    ) {
      throw this.unauthorized();
    }
  }

  private encrypt(bundle: TokenBundle, aad: string): string {
    const iv = randomBytes(12);
    const key = this.encryptionKeys.get(this.currentEncryptionKeyId);
    if (!key) throw new Error('OIDC session encryption key unavailable');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(bundle), 'utf8'),
      cipher.final(),
    ]);
    return [
      'v2',
      this.currentEncryptionKeyId,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  private decrypt(value: string, aad: string): TokenBundle {
    try {
      const parts = value.split('.');
      const [version, keyId, iv, tag, ciphertext] = parts;
      const v1 = version === 'v1';
      const effectiveKeyId = v1 ? 'legacy' : keyId;
      const effectiveIv = v1 ? keyId : iv;
      const effectiveTag = v1 ? iv : tag;
      const effectiveCiphertext = v1 ? tag : ciphertext;
      if (
        !effectiveKeyId ||
        !effectiveIv ||
        !effectiveTag ||
        !effectiveCiphertext
      )
        throw new Error();
      const key = this.encryptionKeys.get(effectiveKeyId);
      if (!key) throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(effectiveIv, 'base64url'),
      );
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(effectiveTag, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(effectiveCiphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      const bundle = JSON.parse(plaintext) as Partial<TokenBundle>;
      if (typeof bundle.accessToken !== 'string') throw new Error();
      return bundle as TokenBundle;
    } catch {
      throw this.unauthorized();
    }
  }

  private setSessionCookies(
    response: Response,
    sessionToken: string,
    csrfToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(
      OIDC_SESSION_COOKIE,
      sessionToken,
      this.sessionCookieOptions(expiresAt),
    );
    response.cookie(
      OIDC_CSRF_COOKIE,
      csrfToken,
      this.csrfCookieOptions(expiresAt),
    );
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(OIDC_SESSION_COOKIE, this.sessionCookieOptions());
    response.clearCookie(OIDC_CSRF_COOKIE, this.csrfCookieOptions());
  }

  private clearLoginCookies(response: Response): void {
    const options = this.loginCookieOptions();
    response.clearCookie(LOGIN_STATE_COOKIE, options);
    response.clearCookie(LOGIN_VERIFIER_COOKIE, options);
    response.clearCookie(LOGIN_RETURN_COOKIE, options);
  }

  private loginCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: LOGIN_COOKIE_PATH,
      maxAge: LOGIN_TTL_MS,
    };
  }

  private sessionCookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/',
      ...(expires ? { expires } : {}),
    };
  }

  private csrfCookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: false,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/',
      ...(expires ? { expires } : {}),
    };
  }

  private validateReturnPath(value: string): string {
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    return value;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException('Invalid or missing API credentials');
  }
}
