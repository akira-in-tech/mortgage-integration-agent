import { z } from 'zod';
import { ProviderCapability } from './types';

const incomeSchema = z
  .object({
    monthlyIncome: z.number().nonnegative().finite(),
    employmentStatus: z.enum([
      'FULL_TIME',
      'PART_TIME',
      'SELF_EMPLOYED',
      'UNEMPLOYED',
    ]),
    bankAccountAge: z.number().int().nonnegative(),
    incomeStability: z.number().min(0).max(100),
  })
  .strict();

const creditSchema = z
  .object({
    creditScore: z.number().int().min(300).max(850),
    debtToIncomeRatio: z.number().min(0).max(10),
    paymentHistory: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']),
    openAccounts: z.number().int().nonnegative(),
    derogatoryMarks: z.number().int().nonnegative(),
  })
  .strict();

const documentSchema = z
  .object({
    w2Valid: z.boolean(),
    payStubValid: z.boolean(),
    bankStatementValid: z.boolean(),
    taxReturnValid: z.boolean(),
    allDocumentsValid: z.boolean(),
    failedDocuments: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const checksAllPass =
      value.w2Valid &&
      value.payStubValid &&
      value.bankStatementValid &&
      value.taxReturnValid;
    if (
      value.allDocumentsValid !== checksAllPass ||
      value.allDocumentsValid !== (value.failedDocuments.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'allDocumentsValid contradicts the individual checks or failedDocuments',
      });
    }
  });

const assetSchema = z
  .object({
    liquidAssets: z.number().nonnegative().finite(),
    investmentAssets: z.number().nonnegative().finite(),
    accountCount: z.number().int().nonnegative(),
    reserveMonths: z.number().nonnegative().finite(),
  })
  .strict();

const identitySchema = z
  .object({
    nameMatch: z.boolean(),
    dateOfBirthMatch: z.boolean(),
    ssnValid: z.boolean(),
    addressMatch: z.boolean(),
    fraudAlertPresent: z.boolean(),
    identityVerified: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const expected =
      value.nameMatch &&
      value.dateOfBirthMatch &&
      value.ssnValid &&
      value.addressMatch &&
      !value.fraudAlertPresent;
    if (value.identityVerified !== expected) {
      context.addIssue({
        code: 'custom',
        message: 'identityVerified contradicts the component checks',
      });
    }
  });

const schemas: Record<ProviderCapability, z.ZodType> = {
  [ProviderCapability.INCOME]: incomeSchema,
  [ProviderCapability.CREDIT]: creditSchema,
  [ProviderCapability.DOCUMENT]: documentSchema,
  [ProviderCapability.ASSET]: assetSchema,
  [ProviderCapability.IDENTITY]: identitySchema,
};

export class ProviderFindingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderFindingContractError';
  }
}

export interface ProviderFindingValidationOptions {
  observedAt: string;
  now?: Date;
  maxTransportAgeMs?: number;
}

/**
 * Canonical post-normalization gate shared by simulator, sandbox, and future
 * production adapters. Provider-specific parsing may vary; the domain finding
 * admitted after this point never does.
 */
export function validateProviderFinding<T>(
  capability: ProviderCapability,
  finding: T,
  options: ProviderFindingValidationOptions,
): T {
  const observedAt = new Date(options.observedAt);
  const now = options.now ?? new Date();
  const maxTransportAgeMs = options.maxTransportAgeMs ?? 5 * 60_000;
  if (
    Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() > now.getTime() + 30_000 ||
    now.getTime() - observedAt.getTime() > maxTransportAgeMs
  ) {
    throw new ProviderFindingContractError(
      `provider ${capability} receipt has an invalid or stale observedAt timestamp`,
    );
  }
  const parsed = schemas[capability].safeParse(finding);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new ProviderFindingContractError(
      `provider ${capability} finding violates the canonical contract: ${detail}`,
    );
  }
  return parsed.data as T;
}
