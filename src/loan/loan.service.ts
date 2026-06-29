import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentService } from '../agent/agent.service';
import {
  LoanApplication,
  LoanTypeEntity,
  LoanDecisionEntity,
} from '../database/entities/loan-application.entity';
import {
  EvaluateLoanInput,
  LoanEvaluationResult,
  LoanDecisionStatus,
} from './loan.model';

@Injectable()
export class LoanService {
  private readonly logger = new Logger(LoanService.name);

  constructor(
    @InjectRepository(LoanApplication)
    private readonly loanApplicationRepository: Repository<LoanApplication>,
    private readonly agentService: AgentService,
  ) {}

  async evaluateLoan(input: EvaluateLoanInput): Promise<LoanEvaluationResult> {
    const applicationId = uuidv4();
    this.logger.log(
      `Starting loan evaluation [applicationId=${applicationId}] [borrowerId=${input.borrowerId}] [amount=${input.requestedAmount}]`,
    );

    // Delegate all orchestration — data fetching, AI decisioning — to AgentService
    const agentResult = await this.agentService.runUnderwritingAgent(input);

    // The GraphQL enums and TypeORM enums share the same string values;
    // explicit casting bridges the two type domains without runtime conversion.
    const application = this.loanApplicationRepository.create({
      id: applicationId,
      borrowerId: input.borrowerId,
      requestedAmount: input.requestedAmount,
      loanType: input.loanType as unknown as LoanTypeEntity,
      decision: agentResult.decision as unknown as LoanDecisionEntity,
      confidence: agentResult.confidence,
      reasoning: agentResult.reasoning,
      incomeVerified: agentResult.incomeVerified,
      documentsValid: agentResult.documentsValid,
      conditions: agentResult.conditions,
      rawIntegrationData: agentResult.rawIntegrationData,
    });

    let savedApplication: LoanApplication;
    try {
      savedApplication = await this.loanApplicationRepository.save(application);
      this.logger.log(
        `Persisted loan application [applicationId=${applicationId}] [decision=${agentResult.decision}]`,
      );
    } catch (err) {
      this.logger.error(`Failed to persist loan application: ${String(err)}`);
      throw new InternalServerErrorException('Failed to save loan application');
    }

    return {
      applicationId,
      decision: agentResult.decision as LoanDecisionStatus,
      confidence: agentResult.confidence,
      reasoning: agentResult.reasoning,
      incomeVerified: agentResult.incomeVerified,
      creditScore: agentResult.creditScore,
      documentsValid: agentResult.documentsValid,
      conditions: agentResult.conditions,
      createdAt: savedApplication.createdAt,
    };
  }
}
