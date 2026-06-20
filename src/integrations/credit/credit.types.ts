export type PaymentHistoryGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface CreditBureauData {
  /** FICO-style credit score, 300–850 */
  creditScore: number;
  /** Debt-to-income ratio as a decimal, e.g. 0.38 = 38% */
  debtToIncomeRatio: number;
  paymentHistory: PaymentHistoryGrade;
  /** Number of open revolving/installment accounts */
  openAccounts: number;
  /** Number of derogatory marks (collections, charge-offs) in the last 7 years */
  derogatoryMarks: number;
}
