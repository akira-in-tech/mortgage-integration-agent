import { Injectable, Logger } from '@nestjs/common';
import { CreditBureauData, PaymentHistoryGrade } from './credit.types';

/**
 * Mock credit bureau service (Experian / Equifax / TransUnion tri-merge).
 * Production implementation would call a bureau aggregator (e.g., Factual Data)
 * using the borrower's SSN and consent token, then normalise the tri-merge report.
 */
@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  async getCreditData(borrowerId: string): Promise<CreditBureauData> {
    this.logger.debug(`Pulling credit report for borrower ${borrowerId}`);

    // Bureau pulls are slower than bank data — simulate 100–400 ms
    await this.simulateLatency(100, 400);

    const seed = this.deterministicSeed(borrowerId);
    const grades: PaymentHistoryGrade[] = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];

    const data: CreditBureauData = {
      // Credit score: 580–820 (realistic mortgage applicant range)
      creditScore: 580 + Math.floor(seed * 240),
      // DTI: 0.18–0.55 (lenders typically cap at 0.43 for qualified mortgages)
      debtToIncomeRatio: parseFloat((0.18 + seed * 0.37).toFixed(2)),
      paymentHistory: grades[Math.floor(seed * grades.length)],
      // Open accounts: 2–18
      openAccounts: 2 + Math.floor(seed * 16),
      // Derogatory marks: 0–3 (heavily weighted toward 0 for realistic distribution)
      derogatoryMarks: Math.floor(seed * 3),
    };

    this.logger.debug(
      `Credit report retrieved [borrowerId=${borrowerId}] [score=${data.creditScore}] [dti=${data.debtToIncomeRatio}]`,
    );
    return data;
  }

  private deterministicSeed(input: string): number {
    // Offset hash to differentiate from Plaid seed for the same borrowerId
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) + hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
