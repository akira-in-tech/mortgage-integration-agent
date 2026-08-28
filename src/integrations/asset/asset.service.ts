import { Injectable, Logger } from '@nestjs/common';
import { AssetVerificationData } from './asset.types';
import { maybeThrowSyntheticProviderFailure } from '../synthetic-provider-failures';

/**
 * Mock asset verification service (checking/savings/investment account
 * aggregation, e.g. Plaid Assets or a VOA vendor). Production would call
 * the aggregator's assets endpoint using the borrower's linked accounts
 * and consent token, then normalize balances across institutions.
 */
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  async getAssetData(borrowerId: string): Promise<AssetVerificationData> {
    this.logger.debug(`Fetching asset data for borrower ${borrowerId}`);
    maybeThrowSyntheticProviderFailure(
      borrowerId,
      'asset-verification-simulator',
    );

    // Aggregating multiple linked accounts is slower than a single bureau
    // pull — simulate 150–450 ms.
    await this.simulateLatency(150, 450);

    const seed = this.deterministicSeed(borrowerId);

    const data: AssetVerificationData = {
      // Liquid assets: $2,000–$82,000
      liquidAssets: 2000 + Math.round(seed * 80000),
      // Investment assets: $0–$150,000 (a different point on the same seed,
      // so the two figures don't move in lockstep)
      investmentAssets: Math.round(((seed * 37) % 1) * 150000),
      // Verified accounts: 1–6
      accountCount: 1 + Math.floor(seed * 6),
      // Reserve months: 0–24
      reserveMonths: Math.floor(seed * 24),
    };

    this.logger.debug(
      `Asset data retrieved [borrowerId=${borrowerId}] [liquidAssets=${data.liquidAssets}] [investmentAssets=${data.investmentAssets}]`,
    );
    return data;
  }

  private deterministicSeed(input: string): number {
    // A third distinct hash algorithm (rotate-and-xor) so asset results
    // differ from the plaid/credit/document seeds for the same borrowerId.
    let hash = 0x9e3779b9;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = ((hash << 13) | (hash >>> 19)) >>> 0;
      hash = (hash * 0x85ebca6b) >>> 0;
    }
    return (hash % 1000) / 1000;
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
