import { Injectable, Logger } from '@nestjs/common';
import { DocumentVerificationResult } from './document.types';

/**
 * Mock document parsing service.
 * Production implementation would call an IDP vendor (e.g., Ocrolus, Encompass)
 * to extract, classify, and validate mortgage document packages via ML-based OCR.
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  async verifyDocuments(
    borrowerId: string,
  ): Promise<DocumentVerificationResult> {
    this.logger.debug(`Verifying document package for borrower ${borrowerId}`);

    // Document parsing is the most latency-intensive step — 200–600 ms in production
    await this.simulateLatency(200, 600);

    const seed = this.deterministicSeed(borrowerId);

    // Most applicants pass most documents; use a 0.85 threshold for validity
    const w2Valid = seed > 0.15;
    const payStubValid = seed > 0.12;
    const bankStatementValid = seed > 0.1;
    const taxReturnValid = seed > 0.2;

    const failed: string[] = [];
    if (!w2Valid) failed.push('W-2');
    if (!payStubValid) failed.push('Pay Stub');
    if (!bankStatementValid) failed.push('Bank Statement');
    if (!taxReturnValid) failed.push('Tax Return');

    const result: DocumentVerificationResult = {
      w2Valid,
      payStubValid,
      bankStatementValid,
      taxReturnValid,
      allDocumentsValid: failed.length === 0,
      failedDocuments: failed,
    };

    this.logger.debug(
      `Document verification complete [borrowerId=${borrowerId}] [allValid=${result.allDocumentsValid}] [failed=${failed.join(', ') || 'none'}]`,
    );
    return result;
  }

  private deterministicSeed(input: string): number {
    // Third distinct hash algorithm so document results differ from credit/plaid seeds
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return (hash % 1000) / 1000;
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
