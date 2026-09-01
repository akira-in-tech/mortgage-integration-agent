import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export interface OidcClaims extends JWTPayload {
  sub: string;
  email?: string;
}

export interface OidcDiscoveryDocument {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
}

export interface OidcTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  id_token?: string;
}

/**
 * Section 16.1's "OIDC/OAuth 2.0 for people" (M5-024) — a real relying
 * party against a real, self-hosted issuer (this codebase's own
 * docker-compose.yml ships Keycloak locally), not a hand-rolled token
 * scheme. Uses real OpenID Connect Discovery (`/.well-known/openid-
 * configuration`) to find the issuer's own `jwks_uri` rather than
 * hardcoding Keycloak's own URL convention — any real OIDC provider
 * works, not just Keycloak, even though Keycloak is the only one this
 * codebase's own tests/live verification ever configure.
 *
 * `jose`'s `createRemoteJWKSet` does its own real HTTP fetch + caching of
 * the signing keys — this service only resolves the discovery document
 * once (cached for the process lifetime; a real issuer's discovery
 * document is expected to be effectively static) and hands the
 * discovered `jwks_uri` to it.
 */
@Injectable()
export class OidcService {
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private discovery: Promise<OidcDiscoveryDocument> | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(configService: ConfigService) {
    this.issuer = configService.get<string>('OIDC_ISSUER_URL');
    this.audience = configService.get<string>('OIDC_AUDIENCE');
    this.clientId =
      configService.get<string>('OIDC_CLIENT_ID') ?? this.audience;
    this.clientSecret = configService.get<string>('OIDC_CLIENT_SECRET');
  }

  /**
   * Verifies a real OIDC access/ID token: real signature (against the
   * issuer's own live JWKS), real `iss`/`aud` match, real expiry — all
   * `jose`'s own responsibility, not reimplemented here. Throws
   * `UnauthorizedException` for every failure (unconfigured issuer,
   * unreachable discovery endpoint, bad signature, wrong audience,
   * expired token) — `OidcGuard` never needs to distinguish which,
   * matching `ApiKeyGuard`'s own "don't leak which part failed"
   * discipline for this exact same reason.
   */
  async verify(token: string): Promise<OidcClaims> {
    return this.verifyToken(token, 'access');
  }

  /**
   * A new self-service user is provisioned from an ID token only: unlike an
   * access token, its `email` claim is identity metadata returned under the
   * requested OIDC `email` scope. Signature, issuer, and client checks stay
   * identical to the access-token path before that metadata is trusted.
   */
  async verifyIdToken(token: string): Promise<OidcClaims> {
    return this.verifyToken(token, 'id');
  }

  private async verifyToken(
    token: string,
    expectedTokenUse: 'access' | 'id',
  ): Promise<OidcClaims> {
    if (!this.issuer || !this.audience) {
      throw new UnauthorizedException('OIDC is not configured');
    }
    try {
      const { jwks, issuer } = await this.resolveJwks();
      const { payload } = await jwtVerify(token, jwks, { issuer });
      // Standard OIDC providers place the relying-party identifier in `aud`.
      // Cognito access tokens instead use `client_id` (its ID tokens retain
      // `aud`). Accept either verified representation, never a token with no
      // matching client identifier, so the BFF can use Cognito access tokens
      // without weakening the audience boundary for existing issuers.
      if (!this.matchesAudience(payload, this.audience)) {
        throw new Error('token audience does not match configured client');
      }
      if (
        payload.token_use !== undefined &&
        payload.token_use !== expectedTokenUse
      ) {
        throw new Error(`token is not an ${expectedTokenUse} token`);
      }
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('token has no sub claim');
      }
      return payload as OidcClaims;
    } catch {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
  }

  /** Builds the provider authorization URL without exposing issuer metadata to the browser application. */
  async buildAuthorizationUrl(input: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
  }): Promise<string> {
    const discovery = await this.getDiscoveryDocument();
    if (!this.clientId || !discovery.authorization_endpoint) {
      throw new UnauthorizedException('OIDC is not configured');
    }
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<OidcTokenResponse> {
    return this.requestTokens({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
  }

  refresh(refreshToken: string): Promise<OidcTokenResponse> {
    return this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async buildLogoutUrl(
    idToken: string | undefined,
    postLogoutRedirectUri: string,
  ): Promise<string | null> {
    const discovery = await this.getDiscoveryDocument();
    if (!this.clientId || !discovery.end_session_endpoint) return null;
    const url = new URL(discovery.end_session_endpoint);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    if (idToken) url.searchParams.set('id_token_hint', idToken);
    return url.toString();
  }

  async getDiscoveryDocument(): Promise<OidcDiscoveryDocument> {
    if (!this.issuer || !this.audience) {
      throw new UnauthorizedException('OIDC is not configured');
    }
    if (!this.discovery) this.discovery = this.fetchDiscoveryDocument();
    return this.discovery;
  }

  private async resolveJwks(): Promise<{
    jwks: ReturnType<typeof createRemoteJWKSet>;
    issuer: string;
  }> {
    if (!this.discovery) {
      this.discovery = this.fetchDiscoveryDocument();
    }
    const discovery = await this.getDiscoveryDocument();
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    }
    return { jwks: this.jwks, issuer: discovery.issuer };
  }

  private async requestTokens(
    input: Record<string, string>,
  ): Promise<OidcTokenResponse> {
    const discovery = await this.getDiscoveryDocument();
    if (!this.clientId || !discovery.token_endpoint) {
      throw new UnauthorizedException('OIDC is not configured');
    }
    const params = new URLSearchParams({ client_id: this.clientId, ...input });
    if (this.clientSecret) params.set('client_secret', this.clientSecret);
    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!response.ok) {
      throw new UnauthorizedException('OIDC token exchange failed');
    }
    const body = (await response.json()) as Partial<OidcTokenResponse>;
    if (
      typeof body.access_token !== 'string' ||
      typeof body.expires_in !== 'number' ||
      !Number.isFinite(body.expires_in) ||
      body.expires_in <= 0 ||
      (body.refresh_expires_in !== undefined &&
        (typeof body.refresh_expires_in !== 'number' ||
          !Number.isFinite(body.refresh_expires_in) ||
          body.refresh_expires_in <= 0))
    ) {
      throw new UnauthorizedException('OIDC token exchange failed');
    }
    return body as OidcTokenResponse;
  }

  private matchesAudience(payload: JWTPayload, expected: string): boolean {
    const audiences = Array.isArray(payload.aud)
      ? payload.aud
      : typeof payload.aud === 'string'
        ? [payload.aud]
        : [];
    const cognitoClientId = payload['client_id'];
    return (
      audiences.includes(expected) ||
      (typeof cognitoClientId === 'string' && cognitoClientId === expected)
    );
  }

  private async fetchDiscoveryDocument(): Promise<OidcDiscoveryDocument> {
    const response = await fetch(
      `${this.issuer}/.well-known/openid-configuration`,
    );
    if (!response.ok) {
      this.discovery = null;
      throw new Error(
        `OIDC discovery failed: HTTP ${response.status} from ${this.issuer}`,
      );
    }
    const document = (await response.json()) as Partial<OidcDiscoveryDocument>;
    if (!document.issuer || !document.jwks_uri) {
      this.discovery = null;
      throw new Error('OIDC discovery document missing issuer/jwks_uri');
    }
    // OIDC Discovery requires exact issuer equality. Accepting metadata for a
    // different issuer enables mix-up and sends authorization/token traffic
    // to endpoints outside the operator-configured trust boundary.
    if (document.issuer !== this.issuer) {
      this.discovery = null;
      throw new Error('OIDC discovery issuer does not match configuration');
    }
    return document as OidcDiscoveryDocument;
  }
}
