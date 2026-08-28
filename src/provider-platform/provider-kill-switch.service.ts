import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import {
  ProviderAdapterState,
  ProviderCapabilityStatus,
} from '../database/enums/provider-platform.enum';
import { ProviderCapability, ProviderMode } from './types';

/**
 * Section 11.4's kill switch, scoped down to what this codebase can back
 * today — see `ProviderAdapterStatus`'s own entity comment for the full
 * reasoning. Not tenant-scoped (no `runInTenantContext`): the table
 * itself carries no tenant dimension.
 */
@Injectable()
export class ProviderKillSwitchService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** No row for a tuple means ACTIVE — the implicit default (see the entity's own comment). */
  async isActive(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
  ): Promise<boolean> {
    const row = await this.dataSource
      .getRepository(ProviderAdapterStatus)
      .findOneBy({
        providerId,
        capability: capability as unknown as ProviderCapabilityStatus,
        mode,
      });
    return !row || row.state === ProviderAdapterState.ACTIVE;
  }

  /**
   * Section 11.4: "Emergency disable remains a single authorized fail-safe
   * action" — no dual-approval requirement for disabling, only for the
   * governed `PRODUCTION_BYOC` re-enable this codebase doesn't build
   * (Known gap). Upserts on the tuple's own unique constraint, so calling
   * this twice for the same tuple just updates the reason/actor/timestamp
   * rather than erroring or creating a duplicate row.
   */
  async disable(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await this.upsert(
      providerId,
      capability,
      mode,
      ProviderAdapterState.DISABLED,
      reason,
      actorId,
    );
  }

  async enable(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
    actorId: string,
  ): Promise<void> {
    await this.upsert(
      providerId,
      capability,
      mode,
      ProviderAdapterState.ACTIVE,
      null,
      actorId,
    );
  }

  private async upsert(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
    state: ProviderAdapterState,
    reason: string | null,
    actorId: string,
  ): Promise<void> {
    const repo = this.dataSource.getRepository(ProviderAdapterStatus);
    const capabilityStatus = capability as unknown as ProviderCapabilityStatus;
    const existing = await repo.findOneBy({
      providerId,
      capability: capabilityStatus,
      mode,
    });
    await repo.save(
      repo.create({
        ...existing,
        providerId,
        capability: capabilityStatus,
        mode,
        state,
        reason,
        updatedBy: actorId,
      }),
    );
  }
}
