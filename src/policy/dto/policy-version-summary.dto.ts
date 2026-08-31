import { ApiProperty } from '@nestjs/swagger';
import { PolicyReleaseStatus } from '../../database/enums/policy-version.enum';
import { PolicyVersion } from '../../database/entities/policy-version.entity';

/**
 * Platform-admin catalog read model. It exposes immutable release metadata
 * and source provenance, not a mutable policy-authoring surface.
 */
export class PolicyVersionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  ruleId!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty({ enum: PolicyReleaseStatus })
  releaseStatus!: PolicyReleaseStatus;

  @ApiProperty()
  effectiveFrom!: Date;

  @ApiProperty({ nullable: true })
  effectiveTo!: Date | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  sourceName!: string;

  @ApiProperty()
  jurisdictionCode!: string;

  @ApiProperty()
  sourcePublishedAt!: Date;

  static from(version: PolicyVersion): PolicyVersionSummaryDto {
    const revision = version.sourceRevision;
    const source = revision?.policySource;
    if (!revision || !source) {
      throw new Error(
        `Policy version ${version.id} is missing source provenance`,
      );
    }
    return {
      id: version.id,
      ruleId: version.ruleId,
      version: version.version,
      releaseStatus: version.releaseStatus,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      recordedAt: version.recordedAt,
      sourceName: source.name,
      jurisdictionCode: source.jurisdictionCode,
      sourcePublishedAt: revision.publishedAt,
    };
  }
}
