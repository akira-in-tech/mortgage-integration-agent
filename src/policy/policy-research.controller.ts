import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { In, Repository } from 'typeorm';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PolicyResearchCitation } from '../database/entities/policy-research-citation.entity';
import { PolicyResearchRun } from '../database/entities/policy-research-run.entity';
import { PolicyResearchRunDto } from './dto/policy-research-run.dto';

/**
 * Research material is platform governance evidence. The endpoint is read
 * only and admin-guarded so a console user cannot mistake a generated brief
 * for a published policy-management action.
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('v1/platform-admin/policy-research-runs')
export class PolicyResearchController {
  constructor(
    @InjectRepository(PolicyResearchRun)
    private readonly runRepository: Repository<PolicyResearchRun>,
    @InjectRepository(PolicyResearchCitation)
    private readonly citationRepository: Repository<PolicyResearchCitation>,
  ) {}

  @ApiOperation({
    operationId: 'listPolicyResearchRuns',
    summary: 'Browse advisory, citation-bound policy research evidence.',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: PolicyResearchRunDto, isArray: true })
  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PolicyResearchRunDto[]> {
    const runs = await this.runRepository.find({
      order: { requestedAt: 'DESC', id: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    if (runs.length === 0) return [];
    const citations = await this.citationRepository.find({
      where: { policyResearchRunId: In(runs.map((run) => run.id)) },
      order: { rank: 'ASC' },
    });
    const citationsByRun = new Map<string, PolicyResearchCitation[]>();
    for (const citation of citations) {
      const bucket = citationsByRun.get(citation.policyResearchRunId) ?? [];
      bucket.push(citation);
      citationsByRun.set(citation.policyResearchRunId, bucket);
    }
    return runs.map((run) =>
      PolicyResearchRunDto.from(run, citationsByRun.get(run.id) ?? []),
    );
  }
}
