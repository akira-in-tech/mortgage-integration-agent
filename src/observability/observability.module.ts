import { Module } from '@nestjs/common';
import { TelemetryLifecycleService } from './telemetry-lifecycle.service';

/** Process-lifecycle wiring; instruments remain vendor-neutral global APIs. */
@Module({ providers: [TelemetryLifecycleService] })
export class ObservabilityModule {}
