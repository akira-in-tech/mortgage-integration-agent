import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProviderPromotionService } from './provider-promotion.service';
import { ProviderCapability, ProviderMode } from './types';
import {
  ActivateManifestDto,
  ApproveManifestDto,
  CertifyManifestDto,
  DeactivateProviderDto,
  ProposeManifestDto,
  ProviderActivationDto,
  ProviderApprovalRecordDto,
  ProviderCertificationRecordDto,
  ProviderPromotionManifestDetailDto,
  ProviderPromotionManifestDto,
} from './dto/provider-promotion.dto';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { CurrentPlatformAdmin } from '../auth/current-platform-admin.decorator';
import { PlatformAdminContext } from '../auth/platform-admin-context';

/**
 * Section 11.4's governed promotion chain (propose -> certify -> approve
 * -> activate), reachable from the console for the first time. Guarded
 * only by `PlatformAdminGuard` — never `TenantAuthGuard` — because this
 * chain controls providers shared across every tenant; see
 * `PlatformAdmin`'s own entity comment for why a tenant credential must
 * never be able to reach it.
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('v1/platform-admin/provider-promotions')
export class ProviderPromotionController {
  constructor(private readonly promotionService: ProviderPromotionService) {}

  @ApiOperation({
    operationId: 'listProviderPromotionManifests',
    summary: 'List proposed provider manifests, most recent first',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: ProviderPromotionManifestDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get('manifests')
  async listManifests(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ProviderPromotionManifestDto[]> {
    const manifests = await this.promotionService.listManifests(limit);
    return manifests.map(ProviderPromotionManifestDto.from);
  }

  @ApiOperation({
    operationId: 'getProviderPromotionManifest',
    summary:
      'One manifest with its full certification/approval history and current activation',
  })
  @ApiParam({ name: 'manifestId', format: 'uuid' })
  @ApiOkResponse({ type: ProviderPromotionManifestDetailDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get('manifests/:manifestId')
  async getManifestDetail(
    @Param('manifestId', ParseUUIDPipe) manifestId: string,
  ): Promise<ProviderPromotionManifestDetailDto> {
    const manifest = await this.findManifestOr404(manifestId);
    const [certifications, approvals, currentActivation] = await Promise.all([
      this.promotionService.listCertifications(manifestId),
      this.promotionService.listApprovals(manifestId),
      this.promotionService.getActivation(
        manifest.providerId,
        manifest.capability as unknown as ProviderCapability,
        manifest.mode as ProviderMode,
      ),
    ]);
    return {
      manifest: ProviderPromotionManifestDto.from(manifest),
      certifications: certifications.map(ProviderCertificationRecordDto.from),
      approvals: approvals.map(ProviderApprovalRecordDto.from),
      currentActivation: currentActivation
        ? ProviderActivationDto.from(currentActivation)
        : null,
    };
  }

  @ApiOperation({
    operationId: 'proposeProviderPromotionManifest',
    summary: 'Propose a new provider adapter manifest',
  })
  @ApiOkResponse({ type: ProviderPromotionManifestDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Post('manifests')
  async propose(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() dto: ProposeManifestDto,
  ): Promise<ProviderPromotionManifestDto> {
    const manifest = await this.promotionService.propose({
      providerId: dto.providerId,
      capability: dto.capability,
      mode: dto.mode as ProviderMode,
      adapterVersion: dto.adapterVersion,
      endpointAllowlist: dto.endpointAllowlist,
      dataClassifications: dto.dataClassifications,
      // proposedBy always comes from the authenticated admin's own name,
      // never something the client could set to someone else's name.
      proposedBy: admin.adminName,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      declaredCommandClass: dto.declaredCommandClass ?? null,
    });
    return ProviderPromotionManifestDto.from(manifest);
  }

  @ApiOperation({
    operationId: 'certifyProviderPromotionManifest',
    summary: 'Record a certification test result for a manifest',
  })
  @ApiParam({ name: 'manifestId', format: 'uuid' })
  @ApiOkResponse({ type: ProviderCertificationRecordDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Post('manifests/:manifestId/certifications')
  async certify(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Param('manifestId', ParseUUIDPipe) manifestId: string,
    @Body() dto: CertifyManifestDto,
  ): Promise<ProviderCertificationRecordDto> {
    const record = await this.runOrBadRequest(() =>
      this.promotionService.certify(
        manifestId,
        dto.environment,
        admin.adminName,
        dto.decision,
        dto.evidenceRef,
        dto.expiresAt ? new Date(dto.expiresAt) : null,
      ),
    );
    return ProviderCertificationRecordDto.from(record);
  }

  @ApiOperation({
    operationId: 'approveProviderPromotionManifest',
    summary: 'Record an approval decision for a manifest',
  })
  @ApiParam({ name: 'manifestId', format: 'uuid' })
  @ApiOkResponse({ type: ProviderApprovalRecordDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Post('manifests/:manifestId/approvals')
  async approve(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Param('manifestId', ParseUUIDPipe) manifestId: string,
    @Body() dto: ApproveManifestDto,
  ): Promise<ProviderApprovalRecordDto> {
    // approve() itself already rejects self-approval — meaningless here
    // since a platform admin approving their own proposal is always the
    // same admin either way, but the service's check still runs (proposedBy
    // is the admin's name either way) and its BadRequestException passes
    // through runOrBadRequest unchanged.
    const record = await this.runOrBadRequest(() =>
      this.promotionService.approve(
        manifestId,
        dto.approvalRole,
        admin.adminName,
        dto.decision,
        dto.expiresAt ? new Date(dto.expiresAt) : null,
      ),
    );
    return ProviderApprovalRecordDto.from(record);
  }

  @ApiOperation({
    operationId: 'activateProviderPromotionManifest',
    summary: 'Activate a certified, approved manifest',
  })
  @ApiParam({ name: 'manifestId', format: 'uuid' })
  @ApiOkResponse({ type: ProviderActivationDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Post('manifests/:manifestId/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Param('manifestId', ParseUUIDPipe) manifestId: string,
    @Body() dto: ActivateManifestDto,
  ): Promise<ProviderActivationDto> {
    const activation = await this.runOrBadRequest(() =>
      this.promotionService.activate(
        manifestId,
        dto.environment,
        admin.adminName,
        dto.expectedCurrentManifestVersion ?? null,
      ),
    );
    return ProviderActivationDto.from(activation);
  }

  @ApiOperation({
    operationId: 'listProviderActivations',
    summary: 'List every provider tuple that has ever been activated',
  })
  @ApiOkResponse({ type: ProviderActivationDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get('activations')
  async listActivations(): Promise<ProviderActivationDto[]> {
    const activations = await this.promotionService.listActivations();
    return activations.map(ProviderActivationDto.from);
  }

  @ApiOperation({
    operationId: 'deactivateProvider',
    summary:
      'Emergency-stop an activated provider tuple (single-actor, no dual control)',
  })
  @ApiOkResponse({ type: ProviderActivationDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() dto: DeactivateProviderDto,
  ): Promise<ProviderActivationDto> {
    const activation = await this.runOrBadRequest(() =>
      this.promotionService.deactivate(
        dto.providerId,
        dto.capability,
        dto.mode as ProviderMode,
        admin.adminName,
      ),
    );
    return ProviderActivationDto.from(activation);
  }

  private async findManifestOr404(manifestId: string) {
    try {
      return await this.promotionService.getManifest(manifestId);
    } catch {
      throw new NotFoundException(`manifest ${manifestId} not found`);
    }
  }

  // Runs a service call, letting its own BadRequestException through
  // unchanged (activate()/approve() already throw real, specific ones —
  // an unresolvable dual-control gate, a stale version, self-approval)
  // and turning anything else (a not-found manifest, a database error)
  // into a plain 400 instead of an unhandled 500. Matches
  // DataDispositionController's own established error-handling shape.
  private async runOrBadRequest<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Request failed.',
      );
    }
  }
}
