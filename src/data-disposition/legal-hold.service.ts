import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LegalHold } from '../database/entities/legal-hold.entity';
import { LegalHoldStatus } from '../database/enums/legal-hold.enum';
import { runInTenantContext } from '../database/tenant-context';
import { AuditEventService } from '../audit/audit-event.service';

/**
 * Section 14.1's `legal_holds` (M5-025) — see `LegalHold`'s own class
 * comment for the full scoping rationale. `hasActiveHold()` is the real
 * enforcement point `DataDispositionService.resolve()` checks before
 * ever deleting or anonymizing evidence — Section 14.2: "legal holds
 * are explicit, scoped, reviewable, and never inferred."
 *
 * `place()`/`release()` write an `AuditEventService` record (M7-028) —
 * the M5 trust-boundary audit found neither one did, and there is no
 * REST controller for legal holds (only the `manage-legal-hold` operator
 * script), so this had been the one material mutation in this codebase
 * with no provenance trail at all. The audit call lives here, not in a
 * future controller, so the script keeps getting it too.
 */
@Injectable()
export class LegalHoldService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditEventService: AuditEventService,
  ) {}

  async place(
    tenantId: string,
    caseId: string,
    reason: string,
    ownerId: string,
  ): Promise<LegalHold> {
    const hold = await runInTenantContext(
      this.dataSource,
      tenantId,
      async (manager) => {
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
      },
    );

    await this.auditEventService.record({
      tenantId,
      actorId: ownerId,
      action: 'LEGAL_HOLD_PLACED',
      resourceType: 'legal_hold',
      resourceId: hold.id,
      reason,
      metadata: { caseId },
    });
    return hold;
  }

  async release(
    tenantId: string,
    legalHoldId: string,
    releasedBy: string,
  ): Promise<LegalHold> {
    const hold = await runInTenantContext(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repo = manager.getRepository(LegalHold);
        const existingHold = await repo.findOneBy({
          id: legalHoldId,
          tenantId,
        });
        if (!existingHold) {
          throw new BadRequestException(`legal hold ${legalHoldId} not found`);
        }
        if (existingHold.status === LegalHoldStatus.RELEASED) {
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
      },
    );

    await this.auditEventService.record({
      tenantId,
      actorId: releasedBy,
      action: 'LEGAL_HOLD_RELEASED',
      resourceType: 'legal_hold',
      resourceId: hold.id,
      metadata: { caseId: hold.caseId },
    });
    return hold;
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
