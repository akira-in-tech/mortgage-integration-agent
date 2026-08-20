import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export interface OidcClaims extends JWTPayload {
  sub: string;
}

interface DiscoveryDocument {
  issuer: string;
  jwks_uri: string;
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
  private discovery: Promise<DiscoveryDocument> | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(configService: ConfigService) {
    this.issuer = configService.get<string>('OIDC_ISSUER_URL');
    this.audience = configService.get<string>('OIDC_AUDIENCE');
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
    if (!this.issuer || !this.audience) {
      throw new UnauthorizedException('OIDC is not configured');
    }
    try {
      const { jwks, issuer } = await this.resolveJwks();
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: this.audience,
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('token has no sub claim');
      }
      return payload as OidcClaims;
    } catch {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
  }

  private async resolveJwks(): Promise<{
    jwks: ReturnType<typeof createRemoteJWKSet>;
    issuer: string;
  }> {
    if (!this.discovery) {
      this.discovery = this.fetchDiscoveryDocument();
    }
    const discovery = await this.discovery;
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    }
    return { jwks: this.jwks, issuer: discovery.issuer };
  }

  private async fetchDiscoveryDocument(): Promise<DiscoveryDocument> {
    const response = await fetch(
      `${this.issuer}/.well-known/openid-configuration`,
    );
    if (!response.ok) {
      this.discovery = null;
      throw new Error(
        `OIDC discovery failed: HTTP ${response.status} from ${this.issuer}`,
      );
    }
    const document = (await response.json()) as Partial<DiscoveryDocument>;
    if (!document.issuer || !document.jwks_uri) {
      this.discovery = null;
      throw new Error('OIDC discovery document missing issuer/jwks_uri');
    }
    return document as DiscoveryDocument;
  }
}
