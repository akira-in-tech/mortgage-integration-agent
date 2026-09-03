import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyResearchCitation } from '../../database/entities/policy-research-citation.entity';
import { PolicyResearchRun } from '../../database/entities/policy-research-run.entity';

class PolicyResearchCitationDto {
  @ApiProperty()
  sourceChecksum!: string;

  @ApiProperty()
  location!: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty()
  excerptDigest!: string;

  @ApiProperty()
  rank!: number;

  @ApiProperty()
  relevanceScore!: string;

  static from(citation: PolicyResearchCitation): PolicyResearchCitationDto {
    return {
      sourceChecksum: citation.sourceChecksum,
      location: citation.location,
      excerpt: citation.excerpt,
      excerptDigest: citation.excerptDigest,
      rank: citation.rank,
      relevanceScore: citation.relevanceScore,
    };
  }
}

/** Reviewer-facing evidence for an advisory research item, never a policy release. */
export class PolicyResearchRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  trigger!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  jurisdictionCode!: string;

  @ApiPropertyOptional()
  productCode!: string | null;

  @ApiPropertyOptional()
  lifecycleEvent!: string | null;

  @ApiProperty({ type: [String] })
  unresolvedReasons!: string[];

  @ApiProperty()
  researchQuery!: string;

  @ApiPropertyOptional()
  candidateSummary!: string | null;

  @ApiPropertyOptional({ type: [String] })
  changeSignals!: string[] | null;

  @ApiPropertyOptional()
  synthesisProvider!: string | null;

  @ApiPropertyOptional()
  failureDetail!: string | null;

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty({ type: [PolicyResearchCitationDto] })
  citations!: PolicyResearchCitationDto[];

  static from(
    run: PolicyResearchRun,
    citations: PolicyResearchCitation[],
  ): PolicyResearchRunDto {
    return {
      id: run.id,
      trigger: run.trigger,
      status: run.status,
      jurisdictionCode: run.jurisdictionCode,
      productCode: run.productCode,
      lifecycleEvent: run.lifecycleEvent,
      unresolvedReasons: run.unresolvedReasons,
      researchQuery: run.researchQuery,
      candidateSummary: run.candidateSummary,
      changeSignals: run.changeSignals,
      synthesisProvider: run.synthesisProvider,
      failureDetail: run.failureDetail,
      requestedAt: run.requestedAt,
      citations: citations.map(PolicyResearchCitationDto.from),
    };
  }
}
