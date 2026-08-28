import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { PlatformAdminStatus } from '../database/enums/platform-admin.enum';
// These functions are plain scrypt hash/verify helpers with nothing
// ApiClient-specific in them (see their own file) — reused as-is rather
// than duplicated for a second credential type.
import { verifyApiClientSecret } from './api-client-secret';
import { PlatformAdminContext } from './platform-admin-context';
import { getRequestFromContext } from './get-request-from-context';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The provider-promotion controller's only guard — never combined with
 * `TenantAuthGuard`/`RoleGuard`. A tenant's own bearer token or OIDC
 * session simply doesn't exist in the `platform_admins` table, so it is
 * rejected here the same way an unknown credential always is: same
 * generic 401, no hint about which part failed, matching `ApiKeyGuard`'s
 * own "don't leak which part failed" discipline.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(PlatformAdmin)
    private readonly platformAdminRepository: Repository<PlatformAdmin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context) as Request & {
      platformAdminContext?: PlatformAdminContext;
    };

    const header = request.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length).trim()
        : undefined;
    const [adminId, secret] = token?.split('.', 2) ?? [];
    if (!adminId || !secret || !UUID_PATTERN.test(adminId)) {
      throw new UnauthorizedException('Invalid or missing admin credentials');
    }

    const admin = await this.platformAdminRepository.findOneBy({
      id: adminId,
    });
    if (
      !admin ||
      admin.status !== PlatformAdminStatus.ACTIVE ||
      !verifyApiClientSecret(secret, admin.hashedSecret)
    ) {
      throw new UnauthorizedException('Invalid or missing admin credentials');
    }

    request.platformAdminContext = {
      adminId: admin.id,
      adminName: admin.name,
      correlationId: randomUUID(),
    };
    return true;
  }
}
