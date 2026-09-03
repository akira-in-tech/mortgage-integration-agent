import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPositive, Max } from 'class-validator';

/**
 * Both fields are optional hypothetical-scenario numbers, not real borrower
 * data — this is still the same public, unauthenticated, disposable sandbox
 * (Section 20 M5-053/M7-054's own boundary). Omitting either falls back to
 * this file's own defaults (see guest-sandbox.service.ts), preserving the
 * original always-the-same guided walkthrough for a visitor who doesn't
 * customize anything.
 *
 * The upper bounds exist only to keep the public demo's own synthetic data
 * sane (this is a scenario input, not a real application) — deliberately
 * generous, not a claim about real mortgage underwriting limits.
 */
export class CreateGuestSandboxSessionDto {
  @ApiPropertyOptional({
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10_000_000,
  })
  @IsOptional()
  @IsPositive()
  @Max(10_000_000)
  requestedAmount?: number;

  @ApiPropertyOptional({
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 1_000_000,
  })
  @IsOptional()
  @IsPositive()
  @Max(1_000_000)
  statedMonthlyIncome?: number;
}
