import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
} from '../../provider-platform/types';
import { PlaidSandboxService } from './plaid-sandbox.service';
import { PlaidIncomeData } from './plaid.types';
import { PlaidIncomeRequest } from './plaid-income.adapter';

export type PlaidIncomeSandboxReceipt =
  SynchronousProviderReceipt<PlaidIncomeData>;

/**
 * Section 11.3's `ProviderAdapter` for the income capability, `AUTHORIZED_
 * SANDBOX` mode (M4-007) — this codebase's first real, non-`SIMULATOR`
 * adapter, genuinely calling `sandbox.plaid.com` through
 * `PlaidSandboxService`. Registered under a distinct `{capability, mode}`
 * key from `PlaidIncomeAdapter` (`ProviderRegistryService.register()`
 * keys by both), so it never collides with or replaces the simulator —
 * `dispatch-provider-request.ts`'s own `mode` parameter (default
 * `SIMULATOR`) is what selects between them; nothing in the live
 * case-conditions workflow requests this mode today, deliberately (see
 * `docs/DEVELOPMENT_LOG.md`'s M4-007 entry for why wiring real bank data
 * into the live underwriting path is out of this slice's own scope).
 */
@Injectable()
export class PlaidIncomeSandboxAdapter implements ProviderAdapter<
  PlaidIncomeRequest,
  PlaidIncomeSandboxReceipt,
  PlaidIncomeData
> {
  readonly providerId = 'plaid-sandbox';
  readonly capability = ProviderCapability.INCOME;
  readonly mode = 'AUTHORIZED_SANDBOX' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly plaidSandboxService: PlaidSandboxService) {}

  async submit(
    request: PlaidIncomeRequest,
  ): Promise<PlaidIncomeSandboxReceipt> {
    const payload = await this.plaidSandboxService.getIncomeData(
      request.borrowerId,
    );
    return { status: 'COMPLETE', payload };
  }

  normalize(payload: unknown): PlaidIncomeData {
    return payload as PlaidIncomeData;
  }

  async healthCheck(): Promise<ProviderHealth> {
    // A real external dependency this time — a genuine reachability
    // check against Plaid's own sandbox host, not the simulator's
    // always-true stub.
    try {
      const res = await fetch('https://sandbox.plaid.com', {
        method: 'HEAD',
      });
      return {
        healthy: res.status < 500,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
