import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
} from '../../provider-platform/types';
import { AssetService } from './asset.service';
import { AssetVerificationData } from './asset.types';

export interface AssetVerificationRequest {
  borrowerId: string;
}

export type AssetVerificationReceipt =
  SynchronousProviderReceipt<AssetVerificationData>;

/**
 * Section 11.3's `ProviderAdapter` for the asset capability, wrapping the
 * new `AssetService` simulator — the fourth capability migrated onto the
 * registry (M4-005), proving the M4-001 pattern generalizes to a
 * capability that had no prior direct-call integration at all, not only
 * ones (income/credit/document) that were already being fetched.
 */
@Injectable()
export class AssetVerificationAdapter implements ProviderAdapter<
  AssetVerificationRequest,
  AssetVerificationReceipt,
  AssetVerificationData
> {
  readonly providerId = 'asset-verification-simulator';
  readonly capability = ProviderCapability.ASSET;
  readonly mode = 'SIMULATOR' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly assetService: AssetService) {}

  async submit(
    request: AssetVerificationRequest,
  ): Promise<AssetVerificationReceipt> {
    const payload = await this.assetService.getAssetData(request.borrowerId);
    return { status: 'COMPLETE', payload };
  }

  normalize(payload: unknown): AssetVerificationData {
    return payload as AssetVerificationData;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
}
