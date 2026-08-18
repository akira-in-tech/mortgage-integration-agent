import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderCapability,
  ProviderHealth,
  ProviderOperationDescriptor,
  SynchronousProviderReceipt,
} from '../../provider-platform/types';
import { DocumentService } from './document.service';
import { DocumentVerificationResult } from './document.types';

export interface DocumentVerificationRequest {
  borrowerId: string;
}

export type DocumentVerificationReceipt =
  SynchronousProviderReceipt<DocumentVerificationResult>;

/**
 * Section 11.3's `ProviderAdapter` for the document capability, wrapping
 * the existing `DocumentService` simulator unchanged (M4-002 — same
 * pattern `PlaidIncomeAdapter` proved for income in M4-001, migrating a
 * third capability onto the registry without touching the registry,
 * dispatch helper, or authorization/intent services).
 */
@Injectable()
export class DocumentVerificationAdapter implements ProviderAdapter<
  DocumentVerificationRequest,
  DocumentVerificationReceipt,
  DocumentVerificationResult
> {
  readonly providerId = 'document-verification-simulator';
  readonly capability = ProviderCapability.DOCUMENT;
  readonly mode = 'SIMULATOR' as const;
  readonly operation: ProviderOperationDescriptor = {
    effectClass: 'REUSABLE_LOOKUP',
    supportsStatusLookup: false,
    supportsCancellation: false,
    fallbackPolicy: 'PROHIBITED',
  };

  constructor(private readonly documentService: DocumentService) {}

  async submit(
    request: DocumentVerificationRequest,
  ): Promise<DocumentVerificationReceipt> {
    const payload = await this.documentService.verifyDocuments(
      request.borrowerId,
    );
    return { status: 'COMPLETE', payload };
  }

  normalize(payload: unknown): DocumentVerificationResult {
    return payload as DocumentVerificationResult;
  }

  async healthCheck(): Promise<ProviderHealth> {
    // No real external dependency to be unhealthy — a real adapter would
    // ping the actual provider here.
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
}
