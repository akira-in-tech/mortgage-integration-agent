import { randomUUID } from 'node:crypto';
import {
  AnyProviderAdapter,
  ProviderAuthorizationGrant,
  ProviderCapability,
  ProviderOperationIntent,
  SynchronousProviderReceipt,
} from './types';
import { validateProviderFinding } from './provider-finding-contract';
import {
  SYNTHETIC_TERMINAL_FAILURE_PREFIX,
  SYNTHETIC_TRANSIENT_FAILURE_PREFIX,
  SyntheticProviderRejectionError,
  SyntheticProviderTimeoutError,
} from '../integrations/synthetic-provider-failures';

export interface ProviderAdapterContractOptions {
  name: string;
  createAdapter: () => AnyProviderAdapter;
  capability: ProviderCapability;
  mode: 'SIMULATOR' | 'AUTHORIZED_SANDBOX' | 'PRODUCTION_BYOC';
  validBorrowerId: string;
  supportsSyntheticFailures: boolean;
}

function fixtures(adapter: AnyProviderAdapter) {
  const tenantId = randomUUID();
  const caseId = randomUUID();
  const intent: ProviderOperationIntent = {
    id: randomUUID(),
    tenantId,
    caseId,
    providerId: adapter.providerId,
    capability: adapter.capability,
    effectClass: adapter.operation.effectClass,
    requestFingerprint: 'a'.repeat(64),
    idempotencyKey: randomUUID(),
    logicalOperationKey: randomUUID(),
    authorizationGrantId: randomUUID(),
    state: 'DISPATCHED',
  };
  const grant: ProviderAuthorizationGrant = {
    id: intent.authorizationGrantId,
    tenantId,
    caseId,
    borrowerSubjectId: 'contract-borrower',
    providerId: adapter.providerId,
    capability: adapter.capability,
    purposeCode: 'CONTRACT_TEST',
    permittedDataClasses: [adapter.capability],
    consentRecordIds: [randomUUID()],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  return { intent, grant, context: { tenantId, caseId } };
}

/**
 * Canonical adapter certification suite. Every simulator and authorized
 * sandbox adapter imports the same assertions; provider-specific tests add
 * only behavior that cannot be expressed by the shared capability contract.
 */
export function describeProviderAdapterContract(
  options: ProviderAdapterContractOptions,
): void {
  describe(`ProviderAdapter contract: ${options.name}`, () => {
    it('declares a stable identity, capability, mode, and safe operation descriptor', () => {
      const adapter = options.createAdapter();
      expect(adapter.providerId).toMatch(/^[a-z0-9-]+$/);
      expect(adapter.capability).toBe(options.capability);
      expect(adapter.mode).toBe(options.mode);
      expect(adapter.operation.effectClass).toMatch(
        /^(READ_ONLY|REUSABLE_LOOKUP|COST_BEARING_ORDER|CONSUMER_IMPACTING|IRREVERSIBLE)$/,
      );
      expect(typeof adapter.operation.supportsStatusLookup).toBe('boolean');
      expect(typeof adapter.operation.supportsCancellation).toBe('boolean');
    });

    it('reports a timestamped health result', async () => {
      const health = await options.createAdapter().healthCheck();
      expect(typeof health.healthy).toBe('boolean');
      expect(Number.isNaN(Date.parse(health.checkedAt))).toBe(false);
    });

    it('submits, normalizes, and passes the canonical capability schema', async () => {
      const adapter = options.createAdapter();
      const { intent, grant, context } = fixtures(adapter);
      const receipt = (await adapter.submit(
        { borrowerId: options.validBorrowerId },
        intent,
        grant,
        context,
      )) as SynchronousProviderReceipt<unknown>;
      expect(receipt.status).toBe('COMPLETE');
      const normalized = adapter.normalize(receipt.payload, context);
      expect(() =>
        validateProviderFinding(adapter.capability, normalized, {
          observedAt: receipt.observedAt,
        }),
      ).not.toThrow();
    });

    if (options.supportsSyntheticFailures) {
      it('maps the deterministic pre-dispatch timeout fixture', async () => {
        const adapter = options.createAdapter();
        const { intent, grant, context } = fixtures(adapter);
        await expect(
          adapter.submit(
            {
              borrowerId: `${SYNTHETIC_TRANSIENT_FAILURE_PREFIX}${options.name}`,
            },
            intent,
            grant,
            context,
          ),
        ).rejects.toBeInstanceOf(SyntheticProviderTimeoutError);
      });

      it('maps the deterministic terminal-rejection fixture', async () => {
        const adapter = options.createAdapter();
        const { intent, grant, context } = fixtures(adapter);
        await expect(
          adapter.submit(
            {
              borrowerId: `${SYNTHETIC_TERMINAL_FAILURE_PREFIX}${options.name}`,
            },
            intent,
            grant,
            context,
          ),
        ).rejects.toBeInstanceOf(SyntheticProviderRejectionError);
      });
    }
  });
}
