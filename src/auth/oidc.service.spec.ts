import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { OidcService } from './oidc.service';

// Requires a reachable Keycloak (this codebase's own docker-compose.yml
// service, or the manual scratch container this session's own live
// verification used): skip instead of failing when OIDC_ISSUER_URL isn't
// configured, the same "real infrastructure, not always available"
// convention this codebase's other describeOrSkip specs already use.
// `reviewer@example.com`/`reviewer-dev-password` is a throwaway dev-only
// credential seeded directly by the checked-in keycloak/realm-export.json
// — not a real secret, safe to reference in test code.
const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL;
const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE ?? 'mortgage-agent-app';
const describeOrSkip = OIDC_ISSUER_URL ? describe : describe.skip;

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

describeOrSkip('OidcService (Section 16.1, M5-024)', () => {
  let service: OidcService;

  beforeAll(() => {
    service = new OidcService(
      new ConfigService({ OIDC_ISSUER_URL, OIDC_AUDIENCE }),
    );
  });

  it('verifies a real Keycloak-issued access token end to end (real signature, issuer, audience) and returns its real claims', async () => {
    const token = await fetchRealToken();
    const claims = await service.verify(token);
    expect(claims.sub).toBeTruthy();
    expect(claims.email).toBe('reviewer@example.com');
    expect(claims.aud).toBe(OIDC_AUDIENCE);
  }, 15_000);

  it('rejects a malformed token', async () => {
    await expect(service.verify('not-a-real-jwt')).rejects.toThrow();
  });

  it('rejects a real, otherwise-valid token when the configured audience does not match', async () => {
    const wrongAudienceService = new OidcService(
      new ConfigService({
        OIDC_ISSUER_URL,
        OIDC_AUDIENCE: 'some-other-client-id-entirely',
      }),
    );
    const token = await fetchRealToken();
    await expect(wrongAudienceService.verify(token)).rejects.toThrow();
  }, 15_000);

  it('throws when OIDC_ISSUER_URL/OIDC_AUDIENCE are not configured at all', async () => {
    const unconfigured = new OidcService(new ConfigService({}));
    await expect(unconfigured.verify('anything')).rejects.toThrow();
  });
});
