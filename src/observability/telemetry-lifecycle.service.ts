import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { shutdownTelemetry } from '../instrumentation';

/** Lets Nest await the final telemetry flush during a graceful API shutdown. */
@Injectable()
export class TelemetryLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
