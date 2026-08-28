import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { User } from '../database/entities/user.entity';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { OidcService } from './oidc.service';
import { AuthContext } from './auth-context';
import { getRequestFromContext } from './get-request-from-context';
import { getResponseFromContext } from './get-response-from-context';
import { OidcSessionService } from './oidc-session.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Section 16.1's "OIDC/OAuth 2.0 for people" (M5-024) — the human half of
 * `TenantAuthGuard`'s composite authentication, alongside `ApiKeyGuard`'s
 * machine half. A valid, real OIDC token alone is *not* enough to act:
 * the caller must also name which tenant it's acting in (`X-Tenant-Id`,
 * since one real human can hold `tenant_memberships` in more than one
 * tenant, unlike an `ApiClient`, which is bound to exactly one tenant at
 * creation) and a `TenantMembership` row must already exist granting
 * that person a role in that specific tenant — an unrecognized `sub` or
 * a real person with no membership in the requested tenant both fail
 * exactly the same generic 401 `ApiKeyGuard` already uses, for the same
 * "don't leak which part failed" reasoning.
 */
@Injectable()
export class OidcGuard implements CanActivate {
  constructor(
    private readonly oidcService: OidcService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantMembership)
    private readonly membershipRepository: Repository<TenantMembership>,
    @Optional()
    private readonly oidcSessionService?: OidcSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context) as Request & {
      authContext?: AuthContext;
    };

    const header = request.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length).trim()
        : undefined;
    const tenantIdHeader = request.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdHeader === 'string' ? tenantIdHeader : undefined;
    if (!tenantId || !UUID_PATTERN.test(tenantId)) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    let user: User | null;
    if (token) {
      const claims = await this.oidcService.verify(token);
      user = await this.userRepository.findOneBy({ subject: claims.sub });
    } else if (this.oidcSessionService) {
      const method = request.method?.toUpperCase();
      const requireCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method ?? '');
      const identity = await this.oidcSessionService.authenticateCookie(
        request,
        getResponseFromContext(context),
        requireCsrf,
      );
      user = identity.user;
    } else {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
    if (!user) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
    const membership = await this.membershipRepository.findOneBy({
      tenantId,
      userId: user.id,
    });
    if (!membership) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    request.authContext = {
      tenantId,
      actorId: user.id,
      role: membership.role,
      correlationId: randomUUID(),
    };
    return true;
  }
}
