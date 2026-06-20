import { Resolver, Query, Args } from '@nestjs/graphql';
import { LoanService } from './loan.service';
import { EvaluateLoanInput, LoanEvaluationResult } from './loan.model';

@Resolver(() => LoanEvaluationResult)
export class LoanResolver {
  constructor(private readonly loanService: LoanService) {}

  /**
   * Entry point for mortgage underwriting. Triggers a full AI-assisted evaluation:
   * parallel integration checks → Claude decisioning → persisted result.
   */
  @Query(() => LoanEvaluationResult, {
    name: 'evaluateLoan',
    description:
      'Run an AI-powered mortgage underwriting evaluation for a borrower.',
  })
  async evaluateLoan(
    @Args('input') input: EvaluateLoanInput,
  ): Promise<LoanEvaluationResult> {
    return this.loanService.evaluateLoan(input);
  }
}
