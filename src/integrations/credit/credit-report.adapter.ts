import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
  completeProviderReceipt,
} from '../../provider-platform/types';
import { CreditService } from './credit.service';
import { CreditBureauData } from './credit.types';

export interface CreditReportRequest {
  borrowerId: string;
}

export type CreditReportReceipt = SynchronousProviderReceipt<CreditBureauData>;

/**
 * Section 11.3's `ProviderAdapter` for the credit capability, wrapping the
 * existing `CreditService` simulator unchanged (M4-002 — same pattern
 * `PlaidIncomeAdapter` proved for income in M4-001, migrating a second
 * capability onto the registry without touching the registry, dispatch
 * helper, or authorization/intent services).
 */
@Injectable()
export class CreditReportAdapter implements ProviderAdapter<
  CreditReportRequest,
  CreditReportReceipt,
  CreditBureauData
> {
  readonly providerId = 'credit-bureau-simulator';
  readonly capability = ProviderCapability.CREDIT;
  readonly mode = 'SIMULATOR' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly creditService: CreditService) {}

  async submit(request: CreditReportRequest): Promise<CreditReportReceipt> {
    const payload = await this.creditService.getCreditData(request.borrowerId);
    return completeProviderReceipt(payload);
  }

  normalize(payload: unknown): CreditBureauData {
    return payload as CreditBureauData;
  }

  async healthCheck(): Promise<ProviderHealth> {
    // No real external dependency to be unhealthy — a real adapter would
    // ping the actual provider here.
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
}
