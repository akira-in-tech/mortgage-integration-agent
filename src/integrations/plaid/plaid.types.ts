export type EmploymentStatus =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'SELF_EMPLOYED'
  | 'UNEMPLOYED';

export interface PlaidIncomeData {
  /** Gross monthly income in USD */
  monthlyIncome: number;
  employmentStatus: EmploymentStatus;
  /** Age of oldest bank account in months */
  bankAccountAge: number;
  /** 0–100 stability score derived from income variance over trailing 12 months */
  incomeStability: number;
}
