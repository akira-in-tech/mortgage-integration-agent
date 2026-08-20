import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LegalHold } from '../database/entities/legal-hold.entity';
import { LegalHoldStatus } from '../database/enums/legal-hold.enum';
import { runInTenantContext } from '../database/tenant-context';

/**
 * Section 14.1's `legal_holds` (M5-025) — see `LegalHold`'s own class
 * comment for the full scoping rationale. `hasActiveHold()` is the real
 * enforcement point `DataDispositionService.resolve()` checks before
 * ever deleting or anonymizing evidence — Section 14.2: "legal holds
 * are explicit, scoped, reviewable, and never inferred."
 */
@Injectable()
export class LegalHoldService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async place(
    tenantId: string,
    caseId: string,
    reason: string,
    ownerId: string,
  ): Promise<LegalHold> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(LegalHold);
      const existing = await repo.findOneBy({
        tenantId,
        caseId,
        status: LegalHoldStatus.ACTIVE,
      });
      if (existing) {
        throw new BadRequestException(
          `case ${caseId} already has an active legal hold (${existing.id}) — release it before placing a new one`,
        );
      }
      return repo.save(repo.create({ tenantId, caseId, reason, ownerId }));
    });
  }

  async release(
    tenantId: string,
    legalHoldId: string,
    releasedBy: string,
  ): Promise<LegalHold> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(LegalHold);
      const hold = await repo.findOneBy({ id: legalHoldId, tenantId });
      if (!hold) {
        throw new BadRequestException(`legal hold ${legalHoldId} not found`);
      }
      if (hold.status === LegalHoldStatus.RELEASED) {
        throw new BadRequestException(
          `legal hold ${legalHoldId} is already released`,
        );
      }
      await repo.update(
        { id: legalHoldId },
        {
          status: LegalHoldStatus.RELEASED,
          releasedAt: new Date(),
          releasedBy,
        },
      );
      return repo.findOneByOrFail({ id: legalHoldId });
    });
  }

  async hasActiveHold(tenantId: string, caseId: string): Promise<boolean> {
    const hold = await runInTenantContext(
      this.dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(LegalHold).findOneBy({
          tenantId,
          caseId,
          status: LegalHoldStatus.ACTIVE,
        }),
    );
    return !!hold;
  }
}
