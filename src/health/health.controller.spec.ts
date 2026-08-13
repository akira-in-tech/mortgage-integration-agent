import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports process liveness without touching dependencies', () => {
    const dataSource = { query: jest.fn() } as unknown as DataSource;
    expect(new HealthController(dataSource).health()).toEqual({ status: 'ok' });
  });

  it('reports database readiness', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(
      dataSource as unknown as DataSource,
    );

    await expect(controller.ready()).resolves.toEqual({
      status: 'ready',
      database: 'available',
    });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns unavailable when the database cannot be reached', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const controller = new HealthController(
      dataSource as unknown as DataSource,
    );

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
