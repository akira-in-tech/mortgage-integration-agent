import 'reflect-metadata';
import { PlaidIncomeAdapter } from '../integrations/plaid/plaid-income.adapter';
import { PlaidIncomeSandboxAdapter } from '../integrations/plaid/plaid-income-sandbox.adapter';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditReportAdapter } from '../integrations/credit/credit-report.adapter';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentVerificationAdapter } from '../integrations/document/document-verification.adapter';
import { DocumentService } from '../integrations/document/document.service';
import { AssetVerificationAdapter } from '../integrations/asset/asset-verification.adapter';
import { AssetService } from '../integrations/asset/asset.service';
import { IdentityVerificationAdapter } from '../integrations/identity/identity-verification.adapter';
import { IdentityService } from '../integrations/identity/identity.service';
import { describeProviderAdapterContract } from './provider-adapter.contract';
import { ProviderCapability } from './types';

describeProviderAdapterContract({
  name: 'plaid-income-simulator',
  createAdapter: () => new PlaidIncomeAdapter(new PlaidService()),
  capability: ProviderCapability.INCOME,
  mode: 'SIMULATOR',
  validBorrowerId: 'contract-income',
  supportsSyntheticFailures: true,
});

describeProviderAdapterContract({
  name: 'credit-simulator',
  createAdapter: () => new CreditReportAdapter(new CreditService()),
  capability: ProviderCapability.CREDIT,
  mode: 'SIMULATOR',
  validBorrowerId: 'contract-credit',
  supportsSyntheticFailures: true,
});

describeProviderAdapterContract({
  name: 'document-simulator',
  createAdapter: () => new DocumentVerificationAdapter(new DocumentService()),
  capability: ProviderCapability.DOCUMENT,
  mode: 'SIMULATOR',
  validBorrowerId: 'contract-document',
  supportsSyntheticFailures: true,
});

describeProviderAdapterContract({
  name: 'asset-simulator',
  createAdapter: () => new AssetVerificationAdapter(new AssetService()),
  capability: ProviderCapability.ASSET,
  mode: 'SIMULATOR',
  validBorrowerId: 'contract-asset',
  supportsSyntheticFailures: true,
});

describeProviderAdapterContract({
  name: 'identity-simulator',
  createAdapter: () => new IdentityVerificationAdapter(new IdentityService()),
  capability: ProviderCapability.IDENTITY,
  mode: 'SIMULATOR',
  validBorrowerId: 'contract-identity',
  supportsSyntheticFailures: true,
});

const sandboxIncome = {
  monthlyIncome: 8500,
  employmentStatus: 'FULL_TIME' as const,
  bankAccountAge: 48,
  incomeStability: 91,
};

describeProviderAdapterContract({
  name: 'plaid-income-authorized-sandbox',
  createAdapter: () =>
    new PlaidIncomeSandboxAdapter({
      getIncomeData: jest.fn().mockResolvedValue(sandboxIncome),
    } as never),
  capability: ProviderCapability.INCOME,
  mode: 'AUTHORIZED_SANDBOX',
  validBorrowerId: 'contract-plaid-sandbox',
  supportsSyntheticFailures: false,
});

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200 } as Response);
});

afterEach(() => {
  jest.restoreAllMocks();
});
