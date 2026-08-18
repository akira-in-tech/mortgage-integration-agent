import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
} from '../../provider-platform/types';
import { IdentityService } from './identity.service';
import { IdentityVerificationResult } from './identity.types';

export interface IdentityVerificationRequest {
  borrowerId: string;
}

export type IdentityVerificationReceipt =
  SynchronousProviderReceipt<IdentityVerificationResult>;

/**
 * Section 11.3's `ProviderAdapter` for the identity capability, wrapping
 * the new `IdentityService` simulator — the fifth and last capability
 * Section 7.2 names, closing out the "income, asset, credit, identity,
 * and document simulators" bullet in Section 20's M4 scope list.
 */
@Injectable()
export class IdentityVerificationAdapter implements ProviderAdapter<
  IdentityVerificationRequest,
  IdentityVerificationReceipt,
  IdentityVerificationResult
> {
  readonly providerId = 'identity-verification-simulator';
  readonly capability = ProviderCapability.IDENTITY;
  readonly mode = 'SIMULATOR' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly identityService: IdentityService) {}

  async submit(
    request: IdentityVerificationRequest,
  ): Promise<IdentityVerificationReceipt> {
    const payload = await this.identityService.verifyIdentity(
      request.borrowerId,
    );
    return { status: 'COMPLETE', payload };
  }

  normalize(payload: unknown): IdentityVerificationResult {
    return payload as IdentityVerificationResult;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
}
