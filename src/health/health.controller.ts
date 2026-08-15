import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface HealthStatus {
  status: 'ok';
}

// Infra probes (load balancers, container orchestrators) poll these
// frequently; exempt from rate limiting so aggressive probing can't report
// a healthy instance as unavailable.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Process is up and able to handle requests. No dependency checks. */
  @Get('live')
  live(): HealthStatus {
    return { status: 'ok' };
  }

  /** Process is up AND its required dependencies are reachable. */
  @Get('ready')
  async ready(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      // Health endpoints are typically unauthenticated; keep the response
      // generic so it can't leak internal database connection details.
      throw new ServiceUnavailableException({
        status: 'error',
        reason: 'database unreachable',
      });
    }
  }
}
