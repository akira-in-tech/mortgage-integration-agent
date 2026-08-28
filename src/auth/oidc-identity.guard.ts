import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { getRequestFromContext } from './get-request-from-context';
import { OidcIdentityContext } from './oidc-identity-context';
import { OidcService } from './oidc.service';
import { OidcSessionService } from './oidc-session.service';
import { getResponseFromContext } from './get-response-from-context';

/**
 * Verifies a human OIDC token before tenant selection. Unlike `OidcGuard`,
 * this guard deliberately grants no tenant-scoped authority: a valid token
 * can discover only the provisioned user's own memberships, after which the
 * existing `OidcGuard` still independently verifies the selected tenant and
 * role on every operational request.
 */
@Injectable()
export class OidcIdentityGuard implements CanActivate {
  constructor(
    private readonly oidcService: OidcService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    private readonly oidcSessionService?: OidcSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context) as Request & {
      oidcIdentity?: OidcIdentityContext;
    };
    const header = request.headers.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length).trim()
        : undefined;
    let user: User | null;
    if (token) {
      const claims = await this.oidcService.verify(token);
      user = await this.userRepository.findOneBy({ subject: claims.sub });
    } else if (this.oidcSessionService) {
      const identity = await this.oidcSessionService.authenticateCookie(
        request,
        getResponseFromContext(context),
        false,
      );
      user = identity.user;
    } else {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
    if (!user) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    request.oidcIdentity = {
      userId: user.id,
      subject: user.subject,
      email: user.email,
    };
    return true;
  }
}
