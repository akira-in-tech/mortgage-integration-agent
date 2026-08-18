import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiClient } from '../database/entities/api-client.entity';
import { ApiClientStatus } from '../database/enums/api-client.enum';
import {
  generateApiClientSecret,
  hashApiClientSecret,
} from './api-client-secret';

export interface CreateApiClientInput {
  tenantId: string;
  name: string;
}

export interface CreateApiClientResult {
  client: ApiClient;
  /** The raw bearer token (`{id}.{secret}`) — generated once, never persisted, never retrievable again after this call returns. */
  token: string;
}

/**
 * No REST endpoint creates an `ApiClient` — the same honest gap this
 * codebase already has for tenant creation itself (README: "seed one
 * directly via the tenants table for local use"). An endpoint that could
 * mint credentials would need its own authentication story first
 * (who's allowed to create API clients?), which is exactly the
 * administrative-duties/RBAC work this slice is not attempting — so
 * `npm run create-api-client` (a script, not an endpoint) is this
 * slice's honest answer, matching `evaluation-report.ts`/
 * `generate-openapi-spec.ts`'s own established script pattern.
 */
@Injectable()
export class ApiClientService {
  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepository: Repository<ApiClient>,
  ) {}

  async create(input: CreateApiClientInput): Promise<CreateApiClientResult> {
    const secret = generateApiClientSecret();
    const client = await this.apiClientRepository.save(
      this.apiClientRepository.create({
        tenantId: input.tenantId,
        name: input.name,
        hashedSecret: hashApiClientSecret(secret),
        status: ApiClientStatus.ACTIVE,
      }),
    );
    return { client, token: `${client.id}.${secret}` };
  }
}
