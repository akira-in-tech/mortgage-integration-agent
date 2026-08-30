import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  MinLength,
} from 'class-validator';
import { ProviderPromotionManifest } from '../../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../../database/entities/provider-activation.entity';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
} from '../../database/enums/provider-promotion.enum';
import { ProviderCapability } from '../types';

// Matches manage-provider-promotion.ts's own VALID_MODES list — only
// SIMULATOR and AUTHORIZED_SANDBOX have a real adapter behind them today,
// but PRODUCTION_BYOC is still a legitimate value to propose a manifest
// for ahead of that adapter existing.
const PROVIDER_MODES = ['SIMULATOR', 'AUTHORIZED_SANDBOX', 'PRODUCTION_BYOC'];

// --- propose ---------------------------------------------------------

export class ProposeManifestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  providerId!: string;

  @ApiProperty({ enum: ProviderCapability })
  @IsEnum(ProviderCapability)
  capability!: ProviderCapability;

  @ApiProperty({ enum: PROVIDER_MODES })
  @IsIn(PROVIDER_MODES)
  mode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  adapterVersion!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  endpointAllowlist!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  dataClassifications!: string[];

  @ApiProperty({ required: false, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiProperty({
    required: false,
    description:
      "Section 7.5's promotion-manifest validator checkpoint: what command class the underlying adapter declares, if any. Rejected outright if it names a structurally excluded class (FUNDS_MOVEMENT, RATE_LOCK, etc.) — nothing today has a real one to declare.",
  })
  @IsOptional()
  @IsString()
  declaredCommandClass?: string;
}

// --- certify -----------------------------------------------------------

export class CertifyManifestDto {
  @ApiProperty({ description: 'e.g. "sandbox", "staging".' })
  @IsString()
  @MinLength(1)
  environment!: string;

  @ApiProperty({ enum: ProviderCertificationDecision })
  @IsEnum(ProviderCertificationDecision)
  decision!: ProviderCertificationDecision;

  @ApiProperty({ description: 'A link or reference to the test evidence.' })
  @IsString()
  @MinLength(1)
  evidenceRef!: string;

  @ApiProperty({ required: false, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

// --- approve -------------------------------------------------------------

export class ApproveManifestDto {
  @ApiProperty({ description: 'e.g. "compliance", "security".' })
  @IsString()
  @MinLength(1)
  approvalRole!: string;

  @ApiProperty({ enum: ProviderApprovalDecision })
  @IsEnum(ProviderApprovalDecision)
  decision!: ProviderApprovalDecision;

  @ApiProperty({ required: false, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

// --- activate / deactivate ---------------------------------------------

export class ActivateManifestDto {
  @ApiProperty({ description: 'e.g. "sandbox", "staging".' })
  @IsString()
  @MinLength(1)
  environment!: string;

  @ApiProperty({
    nullable: true,
    description:
      'The manifestVersion this admin last saw active for this tuple ' +
      '(null if never activated) — an optimistic lock against two admins ' +
      'racing to activate two different manifests.',
  })
  @IsOptional()
  @IsInt()
  expectedCurrentManifestVersion!: number | null;
}

export class DeactivateProviderDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  providerId!: string;

  @ApiProperty({ enum: ProviderCapability })
  @IsEnum(ProviderCapability)
  capability!: ProviderCapability;

  @ApiProperty({ enum: PROVIDER_MODES })
  @IsIn(PROVIDER_MODES)
  mode!: string;
}

// --- responses -----------------------------------------------------------

export class ProviderPromotionManifestDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  capability!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  adapterVersion!: string;

  @ApiProperty({ type: [String] })
  endpointAllowlist!: string[];

  @ApiProperty({ type: [String] })
  dataClassifications!: string[];

  @ApiProperty()
  contentHash!: string;

  @ApiProperty()
  proposedBy!: string;

  @ApiProperty({ format: 'date-time' })
  proposedAt!: string;

  @ApiProperty({ format: 'date-time' })
  validFrom!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({ nullable: true })
  declaredCommandClass!: string | null;

  static from(m: ProviderPromotionManifest): ProviderPromotionManifestDto {
    return {
      id: m.id,
      providerId: m.providerId,
      capability: m.capability,
      mode: m.mode,
      version: m.version,
      adapterVersion: m.adapterVersion,
      endpointAllowlist: m.endpointAllowlist,
      dataClassifications: m.dataClassifications,
      contentHash: m.contentHash,
      proposedBy: m.proposedBy,
      proposedAt: m.proposedAt.toISOString(),
      validFrom: m.validFrom.toISOString(),
      validUntil: m.validUntil ? m.validUntil.toISOString() : null,
      declaredCommandClass: m.declaredCommandClass,
    };
  }
}

export class ProviderCertificationRecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  environment!: string;

  @ApiProperty()
  certifiedBy!: string;

  @ApiProperty({ enum: ProviderCertificationDecision })
  decision!: ProviderCertificationDecision;

  @ApiProperty()
  evidenceRef!: string;

  @ApiProperty({ format: 'date-time' })
  decidedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  expiresAt!: string | null;

  static from(c: ProviderCertificationRecord): ProviderCertificationRecordDto {
    return {
      id: c.id,
      environment: c.environment,
      certifiedBy: c.certifiedBy,
      decision: c.decision,
      evidenceRef: c.evidenceRef,
      decidedAt: c.decidedAt.toISOString(),
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    };
  }
}

export class ProviderApprovalRecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  approvalRole!: string;

  @ApiProperty()
  approvedBy!: string;

  @ApiProperty({ enum: ProviderApprovalDecision })
  decision!: ProviderApprovalDecision;

  @ApiProperty({ format: 'date-time' })
  decidedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  expiresAt!: string | null;

  static from(a: ProviderApprovalRecord): ProviderApprovalRecordDto {
    return {
      id: a.id,
      approvalRole: a.approvalRole,
      approvedBy: a.approvedBy,
      decision: a.decision,
      decidedAt: a.decidedAt.toISOString(),
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
    };
  }
}

export class ProviderActivationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  capability!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty({ format: 'uuid' })
  manifestId!: string;

  @ApiProperty()
  manifestVersion!: number;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  activatedBy!: string;

  @ApiProperty({ format: 'date-time' })
  activatedAt!: string;

  static from(a: ProviderActivation): ProviderActivationDto {
    return {
      id: a.id,
      providerId: a.providerId,
      capability: a.capability,
      mode: a.mode,
      manifestId: a.manifestId,
      manifestVersion: a.manifestVersion,
      state: a.state,
      activatedBy: a.activatedBy,
      activatedAt: a.activatedAt.toISOString(),
    };
  }
}

// The full picture for one manifest in a single response — its own
// fields plus its certification/approval history and, if its
// {providerId, capability, mode} tuple has ever been activated, the
// current activation row. Everything a platform admin needs to decide
// the next step, without a chain of follow-up requests.
export class ProviderPromotionManifestDetailDto {
  @ApiProperty({ type: ProviderPromotionManifestDto })
  manifest!: ProviderPromotionManifestDto;

  @ApiProperty({ type: [ProviderCertificationRecordDto] })
  certifications!: ProviderCertificationRecordDto[];

  @ApiProperty({ type: [ProviderApprovalRecordDto] })
  approvals!: ProviderApprovalRecordDto[];

  @ApiProperty({ type: ProviderActivationDto, nullable: true })
  currentActivation!: ProviderActivationDto | null;
}
