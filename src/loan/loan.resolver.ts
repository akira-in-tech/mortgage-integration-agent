import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { LoanService } from './loan.service';
import { EvaluateLoanInput, LoanEvaluationResult } from './loan.model';

@Resolver(() => LoanEvaluationResult)
export class LoanResolver {
  constructor(private readonly loanService: LoanService) {}

  @Mutation(() => LoanEvaluationResult, {
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
