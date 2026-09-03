import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TemporalClientService } from '../workflows/temporal-client.service';

interface HealthStatus {
  status: 'ok';
}

// Infra probes (load balancers, container orchestrators) poll these
// frequently; exempt from rate limiting so aggressive probing can't report
// a healthy instance as unavailable.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly temporalClient: TemporalClientService,
  ) {}

  /** Process is up and able to handle requests. No dependency checks. */
  @Get('live')
  live(): HealthStatus {
    return { status: 'ok' };
  }

  /**
   * Process is up AND its required dependencies are reachable.
   *
   * Temporal reachability (M7-073) was a real, discovered-live gap here:
   * this endpoint used to check only the database, so ECS's own health
   * check (which polls exactly this route) never noticed a real incident
   * where the API's long-lived Temporal gRPC connection silently died
   * during a quiet traffic period -- the container kept reporting healthy
   * for hours while every real "run evaluation" request failed with
   * "Failed to connect before the deadline". Checked in parallel with the
   * database so one slow dependency doesn't double this endpoint's own
   * latency.
   */
  @Get('ready')
  async ready(): Promise<HealthStatus> {
    const [db, temporal] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.temporalClient.checkConnectivity(),
    ]);
    if (db.status === 'rejected' || temporal.status === 'rejected') {
      // Health endpoints are typically unauthenticated; keep the response
      // generic so it can't leak internal connection details.
      throw new ServiceUnavailableException({
        status: 'error',
        reason:
          db.status === 'rejected' && temporal.status === 'rejected'
            ? 'database and Temporal unreachable'
            : db.status === 'rejected'
              ? 'database unreachable'
              : 'Temporal unreachable',
      });
    }
    return { status: 'ok' };
  }
}
