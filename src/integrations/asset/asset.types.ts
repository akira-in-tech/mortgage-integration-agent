export interface AssetVerificationData {
  /** Sum of checking + savings account balances, USD */
  liquidAssets: number;
  /** Sum of retirement/brokerage account balances, USD */
  investmentAssets: number;
  /** Number of distinct asset accounts verified */
  accountCount: number;
  /** Months of reserves `liquidAssets` alone would cover — a common mortgage underwriting reserve-requirement figure (not computed against any real housing-payment figure yet, since this codebase has no such field to divide by). */
  reserveMonths: number;
}
