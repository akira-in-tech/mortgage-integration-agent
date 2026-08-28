import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { PlaidIncomeAdapter } from './plaid/plaid-income.adapter';
import { PlaidIncomeSandboxAdapter } from './plaid/plaid-income-sandbox.adapter';
import { CreditReportAdapter } from './credit/credit-report.adapter';
import { DocumentVerificationAdapter } from './document/document-verification.adapter';
import { AssetVerificationAdapter } from './asset/asset-verification.adapter';
import { IdentityVerificationAdapter } from './identity/identity-verification.adapter';

/**
 * Registers every real adapter this codebase has with
 * `ProviderRegistryService` at process startup — the concrete proof of
 * exit evidence "a new simulator adapter is added without domain or
 * Agent changes": adding a capability means adding one adapter class and
 * one `register()` call here, never touching `ProviderRegistryService`,
 * `dispatch-provider-request.ts`, or any workflow/Agent code that calls
 * `registry.resolve()`. M4-002 proved this by adding credit and document
 * with no change outside this file and the two new adapter classes;
 * M4-005 proved it again with asset and identity — the fourth and fifth
 * capabilities Section 7.2 names, and the first two that had no prior
 * direct-call integration to migrate from at all.
 */
@Injectable()
export class ProviderAdapterBootstrapService implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly plaidIncomeAdapter: PlaidIncomeAdapter,
    private readonly plaidIncomeSandboxAdapter: PlaidIncomeSandboxAdapter,
    private readonly creditReportAdapter: CreditReportAdapter,
    private readonly documentVerificationAdapter: DocumentVerificationAdapter,
    private readonly assetVerificationAdapter: AssetVerificationAdapter,
    private readonly identityVerificationAdapter: IdentityVerificationAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.plaidIncomeAdapter);
    // M4-007: registering costs nothing at boot (a plain in-memory map
    // insert, no network call) — the real credential check only happens
    // if/when something actually dispatches to AUTHORIZED_SANDBOX mode,
    // matching this codebase's own established "fail at call time, not
    // boot time" convention for missing configuration.
    this.registry.register(this.plaidIncomeSandboxAdapter);
    this.registry.register(this.creditReportAdapter);
    this.registry.register(this.documentVerificationAdapter);
    this.registry.register(this.assetVerificationAdapter);
    this.registry.register(this.identityVerificationAdapter);
  }
}
