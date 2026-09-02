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
import { Brackets, Repository } from 'typeorm';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyVersionSummaryDto } from './dto/policy-version-summary.dto';

/**
 * The policy catalog is shared platform governance, so this read is guarded
 * by a platform-admin credential rather than a tenant reviewer. It is
 * intentionally read-only: publishing and legal review remain governed
 * lifecycle processes, never console conveniences.
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('v1/platform-admin/policy-versions')
export class PolicyCatalogController {
  constructor(
    @InjectRepository(PolicyVersion)
    private readonly policyVersionRepository: Repository<PolicyVersion>,
  ) {}

  @ApiOperation({
    operationId: 'listPolicyVersions',
    summary: 'Browse immutable policy-version metadata and source provenance.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Rule, source, or jurisdiction substring.',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: PolicyVersionSummaryDto, isArray: true })
  @Get()
  async list(
    @Query('query') query: string | undefined,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PolicyVersionSummaryDto[]> {
    const normalized = query?.trim();
    const builder = this.policyVersionRepository
      .createQueryBuilder('version')
      .innerJoinAndSelect('version.sourceRevision', 'revision')
      .innerJoinAndSelect('revision.policySource', 'source')
      .orderBy('version.recordedAt', 'DESC')
      .addOrderBy('version.id', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100));

    if (normalized) {
      builder.where(
        new Brackets((where) => {
          where
            .where('version."ruleId" ILIKE :query')
            .orWhere('source.name ILIKE :query')
            .orWhere('source."jurisdictionCode" ILIKE :query');
        }),
        { query: `%${normalized.replace(/[\\%_]/g, '\\$&')}%` },
      );
    }

    return (await builder.getMany()).map(PolicyVersionSummaryDto.from);
  }
}
