import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAdmin } from '../database/entities/platform-admin.entity';
import { PlatformAdminStatus } from '../database/enums/platform-admin.enum';
import {
  generateApiClientSecret,
  hashApiClientSecret,
} from './api-client-secret';

export interface CreatePlatformAdminResult {
  admin: PlatformAdmin;
  /** The raw bearer token (`{id}.{secret}`) — generated once, never persisted, never retrievable again after this call returns. */
  token: string;
}

/**
 * No REST endpoint mints a platform admin, same reasoning as
 * `ApiClientService`'s own comment: an endpoint that could create a
 * credential this powerful would need its own answer for "who's allowed
 * to call it" first, which is exactly the problem this credential exists
 * to be the answer to. `npm run create-platform-admin` (a script) is the
 * only way in, run by whoever already has direct database access — the
 * same trust boundary this codebase's other bootstrapping scripts
 * (`create-api-client.ts`) already rely on.
 */
@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(PlatformAdmin)
    private readonly platformAdminRepository: Repository<PlatformAdmin>,
  ) {}

  async create(name: string): Promise<CreatePlatformAdminResult> {
    const secret = generateApiClientSecret();
    const admin = await this.platformAdminRepository.save(
      this.platformAdminRepository.create({
        name,
        hashedSecret: hashApiClientSecret(secret),
        status: PlatformAdminStatus.ACTIVE,
      }),
    );
    return { admin, token: `${admin.id}.${secret}` };
  }
}
