import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
} from '../../provider-platform/types';
import { PlaidService } from './plaid.service';
import { PlaidIncomeData } from './plaid.types';

export interface PlaidIncomeRequest {
  borrowerId: string;
}

export type PlaidIncomeReceipt = SynchronousProviderReceipt<PlaidIncomeData>;

/**
 * Section 11.3's `ProviderAdapter` for the income capability, wrapping
 * the existing `PlaidService` simulator (unchanged — M4-001 adapts the
 * calling contract around it, not the simulator logic itself) rather than
 * duplicating its deterministic-fixture behavior.
 */
@Injectable()
export class PlaidIncomeAdapter implements ProviderAdapter<
  PlaidIncomeRequest,
  PlaidIncomeReceipt,
  PlaidIncomeData
> {
  readonly providerId = 'plaid-simulator';
  readonly capability = ProviderCapability.INCOME;
  readonly mode = 'SIMULATOR' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly plaidService: PlaidService) {}

  async submit(request: PlaidIncomeRequest): Promise<PlaidIncomeReceipt> {
    const payload = await this.plaidService.getIncomeData(request.borrowerId);
    return { status: 'COMPLETE', payload };
  }

  normalize(payload: unknown): PlaidIncomeData {
    return payload as PlaidIncomeData;
  }

  async healthCheck(): Promise<ProviderHealth> {
    // No real external dependency to be unhealthy — a real adapter would
    // ping the actual provider here.
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
}
