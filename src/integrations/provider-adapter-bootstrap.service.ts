import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { PlaidIncomeAdapter } from './plaid/plaid-income.adapter';
import { CreditReportAdapter } from './credit/credit-report.adapter';
import { DocumentVerificationAdapter } from './document/document-verification.adapter';

/**
 * Registers every real adapter this codebase has with
 * `ProviderRegistryService` at process startup — the concrete proof of
 * exit evidence "a new simulator adapter is added without domain or
 * Agent changes": adding a capability means adding one adapter class and
 * one `register()` call here, never touching `ProviderRegistryService`,
 * `dispatch-provider-request.ts`, or any workflow/Agent code that calls
 * `registry.resolve()`. M4-002 proved this by adding credit and document
 * with no change outside this file and the two new adapter classes.
 */
@Injectable()
export class ProviderAdapterBootstrapService implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly plaidIncomeAdapter: PlaidIncomeAdapter,
    private readonly creditReportAdapter: CreditReportAdapter,
    private readonly documentVerificationAdapter: DocumentVerificationAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.plaidIncomeAdapter);
    this.registry.register(this.creditReportAdapter);
    this.registry.register(this.documentVerificationAdapter);
  }
}
