import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { OidcGuard } from './oidc.guard';

/**
 * The single guard every tenant-scoped controller uses
 * (`@UseGuards(TenantAuthGuard)`, M5-024) — composes `ApiKeyGuard`
 * (machine `api_clients`) and `OidcGuard` (OIDC-linked human `users`/
 * `tenant_memberships`) as *alternatives*, not both required: a request
 * authenticates if either credential type checks out. NestJS's own
 * `@UseGuards(...)` only composes guards with AND semantics (every guard
 * must pass); there is no built-in OR, so this class does it explicitly.
 * `ApiKeyGuard` runs first — its own shape check on the bearer token
 * rejects a JWT-shaped token instantly with no database query, so trying
 * it first costs nothing extra when the real credential turns out to be
 * OIDC. Both underlying guards already throw the same generic,
 * information-free `UnauthorizedException` message on every failure path
 * (`ApiKeyGuard`'s own "don't leak which part failed" discipline) — this
 * guard's own final fallback preserves that.
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly oidcGuard: OidcGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.apiKeyGuard.canActivate(context);
    } catch {
      return this.oidcGuard.canActivate(context);
    }
  }
}
