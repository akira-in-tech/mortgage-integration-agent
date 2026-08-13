import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LoanService } from './loan.service';
import { EvaluateLoanInput, LoanEvaluationResult } from './loan.model';
import { ApiKeyGuard } from '../common/api-key.guard';
import { GraphqlThrottlerGuard } from '../common/graphql-throttler.guard';

@Resolver(() => LoanEvaluationResult)
export class LoanResolver {
  constructor(private readonly loanService: LoanService) {}

  @Query(() => String, { name: 'health' })
  health(): string {
    return 'ok';
  }

  @Mutation(() => LoanEvaluationResult, {
    name: 'evaluateLoan',
    description:
      'Run an AI-powered mortgage underwriting evaluation for a borrower.',
  })
  @UseGuards(ApiKeyGuard, GraphqlThrottlerGuard)
  async evaluateLoan(
    @Args('input') input: EvaluateLoanInput,
  ): Promise<LoanEvaluationResult> {
    return this.loanService.evaluateLoan(input);
  }
}
