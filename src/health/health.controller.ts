import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; database: 'available' }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', database: 'available' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'unavailable',
      });
    }
  }
}
