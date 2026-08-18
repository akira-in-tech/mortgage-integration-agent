import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { PlaidIncomeAdapter } from './plaid/plaid-income.adapter';

/**
 * Registers every real adapter this codebase has with
 * `ProviderRegistryService` at process startup — the concrete proof of
 * exit evidence "a new simulator adapter is added without domain or
 * Agent changes": adding a capability means adding one adapter class and
 * one `register()` call here, never touching `ProviderRegistryService`,
 * `dispatch-provider-request.ts`, or any workflow/Agent code that calls
 * `registry.resolve()`.
 */
@Injectable()
export class ProviderAdapterBootstrapService implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly plaidIncomeAdapter: PlaidIncomeAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.plaidIncomeAdapter);
  }
}
