import { Injectable } from '@nestjs/common';
import { AnyProviderAdapter, ProviderCapability, ProviderMode } from './types';

function key(capability: ProviderCapability, mode: ProviderMode): string {
  return `${capability}|${mode}`;
}

/**
 * Section 11.6's routing starting point: "tenant authorization and
 * operating mode" then "product, jurisdiction, and capability
 * eligibility" are the first two constraints, before health/cost/
 * fallback-order refinement this codebase has no real data to optimize
 * over yet (only one adapter is ever registered per capability today, so
 * there's nothing to choose between). `resolve()` is exit evidence's own
 * bar in miniature: adding a new simulator adapter means one more
 * `register()` call, never a change to this class or to any
 * domain/workflow/Agent code that calls `resolve()`.
 */
@Injectable()
export class ProviderRegistryService {
  private readonly adapters = new Map<string, AnyProviderAdapter>();

  register(adapter: AnyProviderAdapter): void {
    const k = key(adapter.capability, adapter.mode);
    if (this.adapters.has(k)) {
      throw new Error(
        `a provider adapter for capability=${adapter.capability} mode=${adapter.mode} is already registered`,
      );
    }
    this.adapters.set(k, adapter);
  }

  resolve(
    capability: ProviderCapability,
    mode: ProviderMode,
  ): AnyProviderAdapter {
    const adapter = this.adapters.get(key(capability, mode));
    if (!adapter) {
      throw new Error(
        `no provider adapter registered for capability=${capability} mode=${mode}`,
      );
    }
    return adapter;
  }

  listRegistered(): AnyProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
