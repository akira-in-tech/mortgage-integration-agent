import { Injectable, Logger } from '@nestjs/common';
import { IdentityVerificationResult } from './identity.types';
import { maybeThrowSyntheticProviderFailure } from '../synthetic-provider-failures';

/**
 * Mock identity verification service (e.g. LexisNexis, Socure, or a
 * bureau's own identity product). Production would call the vendor's
 * identity-verification endpoint with the borrower's stated PII and
 * consent token, then map its match/alert response.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  async verifyIdentity(
    borrowerId: string,
  ): Promise<IdentityVerificationResult> {
    this.logger.debug(`Verifying identity for borrower ${borrowerId}`);
    maybeThrowSyntheticProviderFailure(
      borrowerId,
      'identity-verification-simulator',
    );

    // Identity checks cross several data sources — simulate 100–350 ms.
    await this.simulateLatency(100, 350);

    const seed = this.deterministicSeed(borrowerId);

    // Most applicants pass most checks; thresholds chosen so failures are
    // the minority case, same distribution shape as DocumentService.
    const nameMatch = seed > 0.05;
    const dateOfBirthMatch = seed > 0.08;
    const ssnValid = seed > 0.03;
    const addressMatch = seed > 0.15;
    const fraudAlertPresent = seed < 0.04;

    const result: IdentityVerificationResult = {
      nameMatch,
      dateOfBirthMatch,
      ssnValid,
      addressMatch,
      fraudAlertPresent,
      identityVerified:
        nameMatch &&
        dateOfBirthMatch &&
        ssnValid &&
        addressMatch &&
        !fraudAlertPresent,
    };

    this.logger.debug(
      `Identity verification complete [borrowerId=${borrowerId}] [verified=${result.identityVerified}]`,
    );
    return result;
  }

  private deterministicSeed(input: string): number {
    // A fourth distinct hash algorithm (sum-of-squares) so identity
    // results differ from the plaid/credit/document/asset seeds for the
    // same borrowerId.
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      hash = (hash + code * code * (i + 1)) >>> 0;
    }
    return (hash % 1000) / 1000;
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
