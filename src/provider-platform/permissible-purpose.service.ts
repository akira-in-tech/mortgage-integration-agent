import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  PermissiblePurposeDecision,
  PermissiblePurposeDecisionStatus,
} from '../database/entities/permissible-purpose-decision.entity';
import { ProviderCapabilityStatus } from '../database/enums/provider-platform.enum';
import { runInTenantContext } from '../database/tenant-context';
import { ProviderCapability, ProviderMode } from './types';

export interface PermissiblePurposeContext {
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  capability: ProviderCapability;
  purposeCode: string;
  permittedDataClasses: string[];
  mode: ProviderMode;
}

@Injectable()
export class PermissiblePurposeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Creates a short-lived decision for synthetic consumer-report fixtures only. */
  async issueSynthetic(context: PermissiblePurposeContext): Promise<string> {
    if (
      context.mode !== 'SIMULATOR' ||
      context.capability !== ProviderCapability.CREDIT
    ) {
      throw new Error(
        'synthetic permissible-purpose decisions are simulator-credit only',
      );
    }
    return runInTenantContext(
      this.dataSource,
      context.tenantId,
      async (manager) => {
        const repo = manager.getRepository(PermissiblePurposeDecision);
        const entity = await repo.save(
          repo.create({
            ...context,
            capability:
              context.capability as unknown as ProviderCapabilityStatus,
            decision: PermissiblePurposeDecisionStatus.AUTHORIZED,
            basisCode: 'SYNTHETIC_MORTGAGE_APPLICATION',
            decidedBy: 'simulator-purpose-policy',
            syntheticOnly: true,
            expiresAt: new Date(Date.now() + 5 * 60_000),
            revokedAt: null,
          }),
        );
        return entity.id;
      },
    );
  }

  async validate(
    decisionId: string,
    context: PermissiblePurposeContext,
  ): Promise<{ valid: true } | { valid: false; reason: string }> {
    const decision = await runInTenantContext(
      this.dataSource,
      context.tenantId,
      (manager) =>
        manager.getRepository(PermissiblePurposeDecision).findOneBy({
          id: decisionId,
        }),
    );
    if (!decision) return { valid: false, reason: 'decision not found' };
    const permitted = new Set(decision.permittedDataClasses);
    if (
      decision.tenantId !== context.tenantId ||
      decision.caseId !== context.caseId ||
      decision.borrowerSubjectId !== context.borrowerSubjectId ||
      (decision.capability as unknown as ProviderCapability) !==
        context.capability ||
      decision.purposeCode !== context.purposeCode ||
      !context.permittedDataClasses.every((value) => permitted.has(value))
    ) {
      return {
        valid: false,
        reason: 'decision scope does not match this request',
      };
    }
    if (decision.decision !== PermissiblePurposeDecisionStatus.AUTHORIZED) {
      return { valid: false, reason: 'decision is not authorized' };
    }
    if (decision.revokedAt || decision.expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'decision is revoked or expired' };
    }
    if (decision.syntheticOnly && context.mode !== 'SIMULATOR') {
      return {
        valid: false,
        reason: 'synthetic decision cannot authorize a live provider mode',
      };
    }
    return { valid: true };
  }
}
