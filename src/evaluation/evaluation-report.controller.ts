import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EvaluationReportRecordService } from './evaluation-report-record.service';
import {
  EvaluationReportDetailDto,
  EvaluationReportSummaryDto,
} from './dto/evaluation-report-response.dto';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import type { EvaluationReport } from './types';

/**
 * Release evidence for the whole platform, not any one tenant's own
 * data — guarded by `PlatformAdminGuard` for the same reason provider
 * promotion is (M7-020): no single tenant's reviewer should be the
 * audience for every other tenant's evaluation runs too.
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('v1/platform-admin/evaluation-reports')
export class EvaluationReportController {
  constructor(private readonly reportService: EvaluationReportRecordService) {}

  @ApiOperation({
    operationId: 'listEvaluationReports',
    summary: 'List saved evaluation runs, most recent first',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: EvaluationReportSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<EvaluationReportSummaryDto[]> {
    const records = await this.reportService.list(limit);
    return records.map(EvaluationReportSummaryDto.from);
  }

  @ApiOperation({
    operationId: 'getEvaluationReport',
    summary: 'One saved evaluation run, every per-case result included',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EvaluationReportDetailDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EvaluationReportDetailDto> {
    const record = await this.findOr404(id);
    return EvaluationReportDetailDto.from(record);
  }

  @ApiOperation({
    operationId: 'downloadEvaluationReport',
    summary: 'The same report as a downloadable JSON file',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'The report, with a Content-Disposition attachment header.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EvaluationReport> {
    const record = await this.findOr404(id);
    response.set(
      'Content-Disposition',
      `attachment; filename="evaluation-report-${id}.json"`,
    );
    return record.report;
  }

  private async findOr404(id: string) {
    try {
      return await this.reportService.get(id);
    } catch {
      throw new NotFoundException(`evaluation report ${id} not found`);
    }
  }
}
