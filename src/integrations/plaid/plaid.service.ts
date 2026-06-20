import { Injectable, Logger } from '@nestjs/common';
import { PlaidIncomeData, EmploymentStatus } from './plaid.types';

/**
 * Mock Plaid income verification service.
 * In production this would call the Plaid /income/verification endpoint,
 * handle OAuth tokens, and map Plaid's response schema to our internal types.
 */
@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);

  async getIncomeData(borrowerId: string): Promise<PlaidIncomeData> {
    this.logger.debug(`Fetching Plaid income data for borrower ${borrowerId}`);

    // Simulate realistic API latency (50–200 ms)
    await this.simulateLatency(50, 200);

    const employmentStatuses: EmploymentStatus[] = [
      'FULL_TIME',
      'PART_TIME',
      'SELF_EMPLOYED',
    ];

    // Seed randomness on borrowerId so the same borrower gets consistent results
    const seed = this.deterministicSeed(borrowerId);

    const data: PlaidIncomeData = {
      // Monthly gross income: $4,000–$25,000
      monthlyIncome: 4000 + Math.floor(seed * 21000),
      employmentStatus:
        employmentStatuses[Math.floor(seed * employmentStatuses.length)],
      // Account age: 6–120 months
      bankAccountAge: 6 + Math.floor(seed * 114),
      // Stability score: 55–100
      incomeStability: 55 + Math.floor(seed * 45),
    };

    this.logger.debug(
      `Plaid income data retrieved [borrowerId=${borrowerId}] [monthlyIncome=${data.monthlyIncome}]`,
    );
    return data;
  }

  private deterministicSeed(input: string): number {
    // Simple deterministic hash → float in [0,1)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
