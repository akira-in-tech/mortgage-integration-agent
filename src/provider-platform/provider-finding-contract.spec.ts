import {
  ProviderFindingContractError,
  validateProviderFinding,
} from './provider-finding-contract';
import { ProviderCapability } from './types';

const now = new Date('2026-08-30T12:00:00.000Z');
const observedAt = now.toISOString();

describe('canonical provider finding contract', () => {
  it('rejects malformed and partial results', () => {
    expect(() =>
      validateProviderFinding(ProviderCapability.INCOME, 'not-an-object', {
        observedAt,
        now,
      }),
    ).toThrow(ProviderFindingContractError);
    expect(() =>
      validateProviderFinding(
        ProviderCapability.CREDIT,
        { creditScore: 700 },
        { observedAt, now },
      ),
    ).toThrow(/canonical contract/);
  });

  it('rejects stale and future-dated receipts before accepting payload data', () => {
    const income = {
      monthlyIncome: 8000,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 24,
      incomeStability: 90,
    };
    expect(() =>
      validateProviderFinding(ProviderCapability.INCOME, income, {
        observedAt: '2026-08-30T11:00:00.000Z',
        now,
        maxTransportAgeMs: 5 * 60_000,
      }),
    ).toThrow(/stale/);
    expect(() =>
      validateProviderFinding(ProviderCapability.INCOME, income, {
        observedAt: '2026-08-30T12:01:00.000Z',
        now,
      }),
    ).toThrow(/invalid or stale/);
  });

  it('rejects contradictory document and identity summaries', () => {
    expect(() =>
      validateProviderFinding(
        ProviderCapability.DOCUMENT,
        {
          w2Valid: false,
          payStubValid: true,
          bankStatementValid: true,
          taxReturnValid: true,
          allDocumentsValid: true,
          failedDocuments: [],
        },
        { observedAt, now },
      ),
    ).toThrow(/contradicts/);
    expect(() =>
      validateProviderFinding(
        ProviderCapability.IDENTITY,
        {
          nameMatch: false,
          dateOfBirthMatch: true,
          ssnValid: true,
          addressMatch: true,
          fraudAlertPresent: false,
          identityVerified: true,
        },
        { observedAt, now },
      ),
    ).toThrow(/contradicts/);
  });

  it('rejects out-of-range numbers and undeclared fields', () => {
    expect(() =>
      validateProviderFinding(
        ProviderCapability.CREDIT,
        {
          creditScore: 999,
          debtToIncomeRatio: 0.4,
          paymentHistory: 'GOOD',
          openAccounts: 2,
          derogatoryMarks: 0,
        },
        { observedAt, now },
      ),
    ).toThrow(/canonical contract/);
    expect(() =>
      validateProviderFinding(
        ProviderCapability.ASSET,
        {
          liquidAssets: 100,
          investmentAssets: 200,
          accountCount: 1,
          reserveMonths: 2,
          rawAccountNumber: 'must-not-cross-contract',
        },
        { observedAt, now },
      ),
    ).toThrow(/Unrecognized key/);
  });
});
